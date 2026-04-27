import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActiveClients } from '@/hooks/useClients';
import { BodyMeasurement, BodyMeasurementInput } from '@/hooks/useBodyMeasurements';

interface BodyMeasurementFormData {
  client_id: string;
  measurement_date: string;
  weight: string;
  bmi: string;
  body_fat_percent: string;
  waist: string;
  hip: string;
  chest: string;
  thigh: string;
  arm: string;
  neck: string;
  calf: string;
  notes: string;
}

const today = new Date().toISOString().split('T')[0];

const emptyFormData: BodyMeasurementFormData = {
  client_id: '',
  measurement_date: today,
  weight: '',
  bmi: '',
  body_fat_percent: '',
  waist: '',
  hip: '',
  chest: '',
  thigh: '',
  arm: '',
  neck: '',
  calf: '',
  notes: '',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  measurement?: BodyMeasurement | null;
  defaultClientId?: string;
  onSubmit: (data: BodyMeasurementInput) => Promise<void>;
  isLoading?: boolean;
}

const parseOptionalNumber = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const numericFields: Array<{ key: keyof Omit<BodyMeasurementFormData, 'client_id' | 'measurement_date' | 'notes'>; label: string; placeholder: string }> = [
  { key: 'weight', label: 'Weight (kg)', placeholder: 'e.g., 72.4' },
  { key: 'bmi', label: 'BMI', placeholder: 'e.g., 24.1' },
  { key: 'body_fat_percent', label: 'Body Fat %', placeholder: 'e.g., 28.5' },
  { key: 'waist', label: 'Waist', placeholder: 'e.g., 34' },
  { key: 'hip', label: 'Hip', placeholder: 'e.g., 40' },
  { key: 'chest', label: 'Chest', placeholder: 'e.g., 38' },
  { key: 'thigh', label: 'Thigh', placeholder: 'e.g., 22' },
  { key: 'arm', label: 'Arm', placeholder: 'e.g., 12.5' },
  { key: 'neck', label: 'Neck', placeholder: 'e.g., 14' },
  { key: 'calf', label: 'Calf', placeholder: 'e.g., 15.5' },
];

export const BodyMeasurementFormDialog = ({ open, onOpenChange, measurement, defaultClientId, onSubmit, isLoading }: Props) => {
  const [formData, setFormData] = useState<BodyMeasurementFormData>(emptyFormData);
  const { data: clients = [] } = useActiveClients();
  const isEdit = !!measurement;

  useEffect(() => {
    if (measurement) {
      setFormData({
        client_id: measurement.client_id,
        measurement_date: measurement.measurement_date || today,
        weight: measurement.weight?.toString() || '',
        bmi: measurement.bmi?.toString() || '',
        body_fat_percent: measurement.body_fat_percent?.toString() || '',
        waist: measurement.waist?.toString() || '',
        hip: measurement.hip?.toString() || '',
        chest: measurement.chest?.toString() || '',
        thigh: measurement.thigh?.toString() || '',
        arm: measurement.arm?.toString() || '',
        neck: measurement.neck?.toString() || '',
        calf: measurement.calf?.toString() || '',
        notes: measurement.notes || '',
      });
      return;
    }

    setFormData({
      ...emptyFormData,
      client_id: defaultClientId || '',
      measurement_date: today,
    });
  }, [measurement, defaultClientId, open]);

  const hasAnyMeasurement = useMemo(() => numericFields.some(({ key }) => !!formData[key].trim()) || !!formData.notes.trim(), [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await onSubmit({
      client_id: formData.client_id,
      measurement_date: formData.measurement_date,
      weight: parseOptionalNumber(formData.weight),
      bmi: parseOptionalNumber(formData.bmi),
      body_fat_percent: parseOptionalNumber(formData.body_fat_percent),
      waist: parseOptionalNumber(formData.waist),
      hip: parseOptionalNumber(formData.hip),
      chest: parseOptionalNumber(formData.chest),
      thigh: parseOptionalNumber(formData.thigh),
      arm: parseOptionalNumber(formData.arm),
      neck: parseOptionalNumber(formData.neck),
      calf: parseOptionalNumber(formData.calf),
      notes: formData.notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Measurement' : 'Add Body Measurement'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_id">Client *</Label>
              <Select value={formData.client_id} onValueChange={(value) => setFormData((prev) => ({ ...prev, client_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="measurement_date">Measurement Date *</Label>
              <Input
                id="measurement_date"
                type="date"
                value={formData.measurement_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, measurement_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Measurements</h3>
              <p className="text-xs text-muted-foreground mt-1">Enter only the values collected during this visit.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {numericFields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type="number"
                    step="0.1"
                    min="0"
                    value={formData[field.key]}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="measurement_notes">Notes</Label>
            <Textarea
              id="measurement_notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional notes about posture, hydration, device used, or visit observations"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.client_id || !formData.measurement_date || !hasAnyMeasurement}>
              {isLoading ? (isEdit ? 'Updating...' : 'Saving...') : (isEdit ? 'Update Measurement' : 'Save Measurement')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
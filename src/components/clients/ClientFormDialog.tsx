import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { Client } from '@/hooks/useClients';
import { useActiveEmployees } from '@/hooks/useEmployees';

const skinTypes = ['Normal', 'Oily', 'Dry', 'Combination', 'Sensitive'];
const hairTypes = ['Normal', 'Oily', 'Dry', 'Frizzy', 'Thin', 'Thick', 'Curly', 'Straight'];
const goals = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'weight_gain', label: 'Weight Gain' },
  { value: 'maintain', label: 'Maintain Weight' },
  { value: 'muscle_building', label: 'Muscle Building' },
];
const dietPreferences = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'non-vegetarian', label: 'Non-Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'eggetarian', label: 'Eggetarian' },
];

interface ClientFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
  date_of_birth: string;
  anniversary_date: string;
  height: string;
  weight: string;
  gender: string;
  skin_type: string;
  hair_type: string;
  goal: string;
  diet_preference: string;
  health_conditions: string[];
  total_fees: string;
  total_receivables: string;
  notes: string;
  is_active: boolean;
  service_start_date: string;
  service_duration_months: string;
  number_of_diet_charts: string;
  employee_id: string;
}

const emptyFormData: ClientFormData = {
  name: '',
  phone: '',
  email: '',
  address: '',
  date_of_birth: '',
  anniversary_date: '',
  height: '',
  weight: '',
  gender: '',
  skin_type: '',
  hair_type: '',
  goal: '',
  diet_preference: '',
  health_conditions: [],
  total_fees: '',
  total_receivables: '',
  notes: '',
  is_active: true,
  service_start_date: '',
  service_duration_months: '',
  number_of_diet_charts: '',
  employee_id: '',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSubmit: (data: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  isLoading?: boolean;
}

export const ClientFormDialog = ({ open, onOpenChange, client, onSubmit, isLoading }: Props) => {
  const [formData, setFormData] = useState<ClientFormData>(emptyFormData);
  const [newCondition, setNewCondition] = useState('');
  const { data: activeEmployees = [] } = useActiveEmployees();
  const isEdit = !!client;

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || '',
        date_of_birth: client.date_of_birth || '',
        anniversary_date: client.anniversary_date || '',
        height: client.height?.toString() || '',
        weight: client.weight?.toString() || '',
        gender: client.gender || '',
        skin_type: client.skin_type || '',
        hair_type: client.hair_type || '',
        goal: client.goal || '',
        diet_preference: client.diet_preference || '',
        health_conditions: client.health_conditions || [],
        total_fees: client.total_fees?.toString() || '',
        total_receivables: client.total_receivables?.toString() || '',
        notes: client.notes || '',
        is_active: client.is_active ?? true,
        service_start_date: client.service_start_date || '',
        service_duration_months: client.service_duration_months?.toString() || '',
        number_of_diet_charts: (client as any).number_of_diet_charts?.toString() || '',
        employee_id: (client as any).employee_id || '',
      });
    } else {
      setFormData(emptyFormData);
    }
  }, [client, open]);

  const addHealthCondition = () => {
    if (newCondition.trim() && !formData.health_conditions.includes(newCondition.trim())) {
      setFormData(prev => ({
        ...prev,
        health_conditions: [...prev.health_conditions, newCondition.trim()],
      }));
      setNewCondition('');
    }
  };

  // Auto-add health condition when input changes
  const handleHealthConditionChange = (value: string) => {
    setNewCondition(value);
    
    // If the input contains commas, split and add multiple conditions
    if (value.includes(',')) {
      const conditions = value.split(',').map(c => c.trim()).filter(c => c);
      const newConditions = conditions.filter(c => c && !formData.health_conditions.includes(c));
      
      if (newConditions.length > 0) {
        setFormData(prev => ({
          ...prev,
          health_conditions: [...prev.health_conditions, ...newConditions],
        }));
        setNewCondition('');
      }
    }
  };

  // Auto-add health condition on blur (when user clicks away)
  const handleHealthConditionBlur = () => {
    if (newCondition.trim() && !formData.health_conditions.includes(newCondition.trim())) {
      setFormData(prev => ({
        ...prev,
        health_conditions: [...prev.health_conditions, newCondition.trim()],
      }));
      setNewCondition('');
    }
  };

  const removeHealthCondition = (condition: string) => {
    setFormData(prev => ({
      ...prev,
      health_conditions: prev.health_conditions.filter(c => c !== condition),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await onSubmit({
      name: formData.name.trim(),
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      address: formData.address.trim() || null,
      date_of_birth: formData.date_of_birth || null,
      anniversary_date: formData.anniversary_date || null,
      height: formData.height ? parseFloat(formData.height) : null,
      weight: formData.weight ? parseFloat(formData.weight) : null,
      gender: formData.gender || null,
      skin_type: formData.skin_type || null,
      hair_type: formData.hair_type || null,
      goal: formData.goal || null,
      diet_preference: formData.diet_preference || null,
      health_conditions: formData.health_conditions.length > 0 ? formData.health_conditions : [],
      total_fees: formData.total_fees ? parseFloat(formData.total_fees) : 0,
      total_receivables: formData.total_receivables ? parseFloat(formData.total_receivables) : 0,
      notes: formData.notes.trim() || null,
      is_active: formData.is_active,
      service_start_date: formData.service_start_date || null,
      service_duration_months: formData.service_duration_months ? parseInt(formData.service_duration_months) : null,
      number_of_diet_charts: formData.number_of_diet_charts ? parseInt(formData.number_of_diet_charts) : null,
      employee_id: formData.employee_id || null,
    } as any);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Client' : 'Add New Client'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Basic Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter client name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter address"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="anniversary">Anniversary Date</Label>
                <Input
                  id="anniversary"
                  type="date"
                  value={formData.anniversary_date}
                  onChange={(e) => setFormData({ ...formData, anniversary_date: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* KYC Data for Diet Plan */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Health & Diet Profile</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  value={formData.height}
                  onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  placeholder="e.g., 170"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="e.g., 65"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="skin_type">Skin Type</Label>
                <Select value={formData.skin_type} onValueChange={(v) => setFormData({ ...formData, skin_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select skin type" />
                  </SelectTrigger>
                  <SelectContent>
                    {skinTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hair_type">Hair Type</Label>
                <Select value={formData.hair_type} onValueChange={(v) => setFormData({ ...formData, hair_type: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select hair type" />
                  </SelectTrigger>
                  <SelectContent>
                    {hairTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="goal">Health Goal</Label>
                <Select value={formData.goal} onValueChange={(v) => setFormData({ ...formData, goal: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {goals.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="diet_preference">Diet Preference</Label>
                <Select value={formData.diet_preference} onValueChange={(v) => setFormData({ ...formData, diet_preference: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select diet preference" />
                  </SelectTrigger>
                  <SelectContent>
                    {dietPreferences.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Health Conditions</Label>
              <div className="flex gap-2">
                <Input
                  value={newCondition}
                  onChange={(e) => handleHealthConditionChange(e.target.value)}
                  onBlur={handleHealthConditionBlur}
                  placeholder="Add health condition (use comma to add multiple)"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHealthCondition())}
                />
                <Button type="button" variant="outline" onClick={addHealthCondition}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {formData.health_conditions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.health_conditions.map((condition) => (
                    <Badge key={condition} variant="secondary" className="flex items-center gap-1">
                      {condition}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => removeHealthCondition(condition)} />
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Type health conditions and press Enter, add comma for multiple conditions, or click away to auto-save
              </p>
            </div>
          </div>

          {/* Service Details */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Service Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service_start_date">Service Start Date</Label>
                <Input
                  id="service_start_date"
                  type="date"
                  value={formData.service_start_date}
                  onChange={(e) => setFormData({ ...formData, service_start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="service_duration_months">Service Duration (Months)</Label>
                <Select
                  value={formData.service_duration_months}
                  onValueChange={(v) => setFormData({ ...formData, service_duration_months: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 6, 9, 12, 18, 24].map(m => (
                      <SelectItem key={m} value={m.toString()}>{m} {m === 1 ? 'month' : 'months'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="number_of_diet_charts">No. of Diet Charts</Label>
                <Select
                  value={formData.number_of_diet_charts}
                  onValueChange={(v) => setFormData({ ...formData, number_of_diet_charts: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select number" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n} {n === 1 ? 'chart' : 'charts'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employee_id">Assign to Employee</Label>
                <Select
                  value={formData.employee_id}
                  onValueChange={(v) => setFormData({ ...formData, employee_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeEmployees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name} — {emp.role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Billing */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Billing</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total_fees">Total Fees (₹)</Label>
                <Input
                  id="total_fees"
                  type="number"
                  step="0.01"
                  value={formData.total_fees}
                  onChange={(e) => setFormData({ ...formData, total_fees: e.target.value })}
                  placeholder="e.g., 5000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_receivables">Balance Receivable (₹)</Label>
                <Input
                  id="total_receivables"
                  type="number"
                  step="0.01"
                  value={formData.total_receivables}
                  onChange={(e) => setFormData({ ...formData, total_receivables: e.target.value })}
                  placeholder="e.g., 2000"
                />
              </div>
            </div>
          </div>

          {/* Notes & Status */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about the client"
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="active">Active Client</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name.trim()}>
              {isLoading ? (isEdit ? 'Updating...' : 'Adding...') : (isEdit ? 'Update Client' : 'Add Client')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

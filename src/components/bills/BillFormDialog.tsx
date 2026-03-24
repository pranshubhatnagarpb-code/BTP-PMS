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
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bill } from '@/hooks/useBills';
import { useActiveClients } from '@/hooks/useClients';

interface BillFormData {
  client_id: string;
  amount: string;
  due_date: string;
  service_name: string;
  status: string;
  paid_amount: string;
  notes: string;
}

const emptyFormData: BillFormData = {
  client_id: '',
  amount: '',
  due_date: '',
  service_name: '',
  status: 'pending',
  paid_amount: '',
  notes: '',
};

const statuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill?: Bill | null;
  onSubmit: (data: Omit<Bill, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  isLoading?: boolean;
}

export const BillFormDialog = ({ open, onOpenChange, bill, onSubmit, isLoading }: Props) => {
  const [formData, setFormData] = useState<BillFormData>(emptyFormData);
  const { data: activeClients = [] } = useActiveClients();
  const isEdit = !!bill;

  useEffect(() => {
    if (bill) {
      setFormData({
        client_id: bill.client_id || '',
        amount: bill.amount?.toString() || '',
        due_date: bill.due_date || '',
        service_name: bill.service_name || '',
        status: bill.status || 'pending',
        paid_amount: bill.paid_amount?.toString() || '',
        notes: bill.notes || '',
      });
    } else {
      setFormData(emptyFormData);
    }
  }, [bill, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await onSubmit({
      client_id: formData.client_id,
      amount: parseFloat(formData.amount) || 0,
      due_date: formData.due_date,
      service_name: formData.service_name.trim(),
      status: formData.status,
      paid_amount: formData.paid_amount ? parseFloat(formData.paid_amount) : null,
      notes: formData.notes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Bill' : 'Create New Bill'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client_id">Client *</Label>
              <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {activeClients.map(client => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="service_name">Service Name *</Label>
              <Input
                id="service_name"
                value={formData.service_name}
                onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
                placeholder="e.g., Diet Consultation"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Total Amount (₹) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="e.g., 5000"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="paid_amount">Paid Amount (₹)</Label>
                <Input
                  id="paid_amount"
                  type="number"
                  step="0.01"
                  value={formData.paid_amount}
                  onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                  placeholder="e.g., 2000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date *</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map(status => (
                      <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about the bill"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.client_id || !formData.amount || !formData.due_date || !formData.service_name}>
              {isLoading ? (isEdit ? 'Updating...' : 'Creating...') : (isEdit ? 'Update Bill' : 'Create Bill')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

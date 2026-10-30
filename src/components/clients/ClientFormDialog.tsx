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
import { BodyMeasurementInput } from '@/hooks/useBodyMeasurements';

const skinTypes = ['Normal', 'Oily', 'Dry', 'Combination', 'Sensitive'];
const hairTypes = ['Normal', 'Oily', 'Dry', 'Frizzy', 'Thin', 'Thick', 'Curly', 'Straight'];
const goals = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'weight_gain', label: 'Weight Gain' },
  { value: 'maintain', label: 'Maintain Weight' },
  { value: 'muscle_building', label: 'Muscle Building' },
  { value: 'disease_management', label: 'Disease Management' }
];
const dietPreferences = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'non-vegetarian', label: 'Non-Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'eggetarian', label: 'Eggetarian' },
];
const clientCategories = [
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'premium_plus', label: 'Premium Plus' },
];

interface ClientFormData {
  name: string;
  address_as: string;
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
  category: string;
  health_conditions: string[];
  supplements: string;
  total_fees: string;
  total_receivables: string;
  notes: string;
  is_active: boolean;
  service_start_date: string;
  service_duration_months: string;
  number_of_diet_charts: string;
  diet_charts_sent_before: string;
  employee_id: string;
  pause_start_date: string;
  pause_duration_days: string;
  measurement_date: string;
  initial_bmi: string;
  initial_body_fat_percent: string;
  initial_waist: string;
  initial_hip: string;
  initial_chest: string;
  initial_thigh: string;
  initial_arm: string;
  initial_neck: string;
  initial_calf: string;
  initial_measurement_notes: string;
}

export interface ClientFormSubmission {
  client: Record<string, any>;
  initialMeasurement?: Omit<BodyMeasurementInput, 'client_id'>;
}

const emptyFormData: ClientFormData = {
  name: '',
  address_as: '',
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
  category: 'standard',
  health_conditions: [],
  supplements: '',
  total_fees: '',
  total_receivables: '',
  notes: '',
  is_active: true,
  service_start_date: '',
  service_duration_months: '',
  number_of_diet_charts: '',
  diet_charts_sent_before: '',
  employee_id: '',
  pause_start_date: '',
  pause_duration_days: '',
  measurement_date: '',
  initial_bmi: '',
  initial_body_fat_percent: '',
  initial_waist: '',
  initial_hip: '',
  initial_chest: '',
  initial_thigh: '',
  initial_arm: '',
  initial_neck: '',
  initial_calf: '',
  initial_measurement_notes: '',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
  onSubmit: (data: ClientFormSubmission) => Promise<void>;
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
        address_as: client.address_as || '',
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
        category: client.category || 'standard',
        health_conditions: client.health_conditions || [],
        supplements: (client as any).supplements || '',
        total_fees: client.total_fees?.toString() || '',
        total_receivables: client.total_receivables?.toString() || '',
        notes: client.notes || '',
        is_active: client.is_active ?? true,
        service_start_date: client.service_start_date || '',
        service_duration_months: client.service_duration_months?.toString() || '',
        number_of_diet_charts: (client as any).number_of_diet_charts?.toString() || '',
        diet_charts_sent_before: client.diet_charts_sent_before ? client.diet_charts_sent_before.toString() : '',
        employee_id: (client as any).employee_id || '',
        pause_start_date: (client as any).pause_start_date || '',
        pause_duration_days: (client as any).service_paused_days?.toString() || '',
        measurement_date: '',
        initial_bmi: '',
        initial_body_fat_percent: '',
        initial_waist: '',
        initial_hip: '',
        initial_chest: '',
        initial_thigh: '',
        initial_arm: '',
        initial_neck: '',
        initial_calf: '',
        initial_measurement_notes: '',
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

    const initialMeasurement = !isEdit && (
      formData.weight ||
      formData.initial_bmi ||
      formData.initial_body_fat_percent ||
      formData.initial_waist ||
      formData.initial_hip ||
      formData.initial_chest ||
      formData.initial_thigh ||
      formData.initial_arm ||
      formData.initial_neck ||
      formData.initial_calf ||
      formData.initial_measurement_notes.trim()
    ) ? {
      measurement_date: formData.measurement_date || new Date().toISOString().split('T')[0],
      weight: formData.weight ? parseFloat(formData.weight) : null,
      bmi: formData.initial_bmi ? parseFloat(formData.initial_bmi) : null,
      body_fat_percent: formData.initial_body_fat_percent ? parseFloat(formData.initial_body_fat_percent) : null,
      waist: formData.initial_waist ? parseFloat(formData.initial_waist) : null,
      hip: formData.initial_hip ? parseFloat(formData.initial_hip) : null,
      chest: formData.initial_chest ? parseFloat(formData.initial_chest) : null,
      thigh: formData.initial_thigh ? parseFloat(formData.initial_thigh) : null,
      arm: formData.initial_arm ? parseFloat(formData.initial_arm) : null,
      neck: formData.initial_neck ? parseFloat(formData.initial_neck) : null,
      calf: formData.initial_calf ? parseFloat(formData.initial_calf) : null,
      notes: formData.initial_measurement_notes.trim() || null,
    } : undefined;
    
    await onSubmit({
      client: {
        name: formData.name.trim(),
        address_as: formData.address_as.trim() || null,
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
        category: formData.category || 'standard',
        health_conditions: formData.health_conditions.length > 0 ? formData.health_conditions : [],
        supplements: formData.supplements.trim() || null,
        total_fees: formData.total_fees ? parseFloat(formData.total_fees) : 0,
        total_receivables: formData.total_receivables ? parseFloat(formData.total_receivables) : 0,
        notes: formData.notes.trim() || null,
        is_active: formData.is_active,
        service_start_date: formData.service_start_date || null,
        service_duration_months: formData.service_duration_months ? parseFloat(formData.service_duration_months) : null,
        number_of_diet_charts: formData.number_of_diet_charts ? parseInt(formData.number_of_diet_charts) : null,
        // Only sent when set (or being cleared), so saving works before the migration is run.
        ...(formData.diet_charts_sent_before || client?.diet_charts_sent_before
          ? { diet_charts_sent_before: Math.max(0, parseInt(formData.diet_charts_sent_before || '0') || 0) }
          : {}),
        employee_id: formData.employee_id || null,
        pause_start_date: formData.pause_start_date || null,
        service_paused_days: formData.pause_duration_days ? parseInt(formData.pause_duration_days) : 0,
        pause_end_date: (formData.pause_start_date && formData.pause_duration_days)
          ? (() => { const d = new Date(formData.pause_start_date); d.setDate(d.getDate() + parseInt(formData.pause_duration_days)); return d.toISOString().split('T')[0]; })()
          : null,
      },
      initialMeasurement,
    });
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
            <div className="space-y-2">
              <Label htmlFor="address_as">How to Address</Label>
              <Input
                id="address_as"
                value={formData.address_as}
                onChange={(e) => setFormData({ ...formData, address_as: e.target.value })}
                placeholder="e.g. Pranshu ji, Pranshu sir, Dr. Mehta"
              />
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
            <div className="space-y-2">
              <Label htmlFor="supplements">Suggested Supplements</Label>
              <Textarea
                id="supplements"
                value={formData.supplements}
                onChange={(e) => setFormData({ ...formData, supplements: e.target.value })}
                placeholder="Enter suggested supplements for this client (e.g., Vitamin D 1000 IU daily, Omega-3 1000mg twice daily, Probiotics 1 capsule daily)"
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">List any recommended supplements with dosage instructions</p>
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
                <Label htmlFor="service_duration_months">Service Duration</Label>
                <Select
                  value={formData.service_duration_months}
                  onValueChange={(v) => setFormData({ ...formData, service_duration_months: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { value: '0.25', label: '1 Week' },
                      { value: '0.75', label: '3 Weeks' },
                      { value: '1',    label: '4 Weeks – 1 Month' },
                      { value: '1.5',  label: '6 Weeks – 45 Days' },
                      { value: '2',    label: '8 Weeks – 2 Months' },
                      { value: '3',    label: '12 Weeks – 3 Months' },
                      { value: '6',    label: '24 Weeks – 6 Months' },
                      { value: '9',    label: '36 Weeks – 9 Months' },
                      { value: '12',   label: '48 Weeks – 1 Year' },
                      { value: '18',   label: '18 Months' },
                      { value: '24',   label: '24 Months – 2 Years' },
                    ].map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
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
              <div className="space-y-2">
                <Label htmlFor="diet_charts_sent_before">Diet charts already sent</Label>
                <Input
                  id="diet_charts_sent_before"
                  type="number"
                  min={0}
                  max={formData.number_of_diet_charts ? parseInt(formData.number_of_diet_charts) : undefined}
                  value={formData.diet_charts_sent_before}
                  onChange={(e) => setFormData({ ...formData, diet_charts_sent_before: e.target.value })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">
                  Sent before this client was added to the PMS — e.g. 7 shows as 7/{formData.number_of_diet_charts || '10'}.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Client Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientCategories.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

          {/* Service Pause */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Service Pause</h3>
              <p className="text-xs text-muted-foreground mt-1">Pause the client's service for a duration. The renewal date will automatically extend by the pause duration.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pause_start_date">Pause Start Date</Label>
                <Input
                  id="pause_start_date"
                  type="date"
                  value={formData.pause_start_date}
                  onChange={(e) => setFormData({ ...formData, pause_start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pause_duration_days">Pause Duration (Days)</Label>
                <Input
                  id="pause_duration_days"
                  type="number"
                  min="0"
                  value={formData.pause_duration_days}
                  onChange={(e) => setFormData({ ...formData, pause_duration_days: e.target.value })}
                  placeholder="e.g., 7"
                />
              </div>
            </div>
            {(() => {
              const startStr = formData.service_start_date;
              const months = parseInt(formData.service_duration_months || '0');
              const pauseDays = parseInt(formData.pause_duration_days || '0') || 0;
              if (!startStr || !months) {
                return (
                  <p className="text-xs text-muted-foreground">Set Service Start Date and Duration to see the renewal date.</p>
                );
              }
              const original = new Date(startStr);
              original.setMonth(original.getMonth() + months);
              const extended = new Date(original);
              extended.setDate(extended.getDate() + pauseDays);
              const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
              return (
                <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Original Renewal Date:</span><span className="font-medium">{fmt(original)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pause Duration:</span><span className="font-medium">{pauseDays} day{pauseDays === 1 ? '' : 's'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Extended Renewal Date:</span><span className="font-semibold text-primary">{fmt(extended)}</span></div>
                  {formData.pause_start_date && pauseDays > 0 && (() => {
                    const pe = new Date(formData.pause_start_date);
                    pe.setDate(pe.getDate() + pauseDays);
                    return (
                      <div className="flex justify-between"><span className="text-muted-foreground">Pause Ends:</span><span className="font-medium">{fmt(pe)}</span></div>
                    );
                  })()}
                </div>
              );
            })()}
          </div>

          {!isEdit && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Initial Body Measurements</h3>
                <p className="text-xs text-muted-foreground mt-1">Optional onboarding values. Leave blank to create the client without a measurement entry.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="measurement_date">Measurement Date</Label>
                  <Input id="measurement_date" type="date" value={formData.measurement_date} onChange={(e) => setFormData({ ...formData, measurement_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initial_bmi">BMI</Label>
                  <Input id="initial_bmi" type="number" step="0.1" min="0" value={formData.initial_bmi} onChange={(e) => setFormData({ ...formData, initial_bmi: e.target.value })} placeholder="e.g., 24.1" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="initial_body_fat_percent">Body Fat %</Label>
                  <Input id="initial_body_fat_percent" type="number" step="0.1" min="0" value={formData.initial_body_fat_percent} onChange={(e) => setFormData({ ...formData, initial_body_fat_percent: e.target.value })} placeholder="e.g., 28.5" />
                </div>
                <div className="space-y-2"><Label htmlFor="initial_waist">Waist</Label><Input id="initial_waist" type="number" step="0.1" min="0" value={formData.initial_waist} onChange={(e) => setFormData({ ...formData, initial_waist: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="initial_hip">Hip</Label><Input id="initial_hip" type="number" step="0.1" min="0" value={formData.initial_hip} onChange={(e) => setFormData({ ...formData, initial_hip: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="initial_chest">Chest</Label><Input id="initial_chest" type="number" step="0.1" min="0" value={formData.initial_chest} onChange={(e) => setFormData({ ...formData, initial_chest: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="initial_thigh">Thigh</Label><Input id="initial_thigh" type="number" step="0.1" min="0" value={formData.initial_thigh} onChange={(e) => setFormData({ ...formData, initial_thigh: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="initial_arm">Arm</Label><Input id="initial_arm" type="number" step="0.1" min="0" value={formData.initial_arm} onChange={(e) => setFormData({ ...formData, initial_arm: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="initial_neck">Neck</Label><Input id="initial_neck" type="number" step="0.1" min="0" value={formData.initial_neck} onChange={(e) => setFormData({ ...formData, initial_neck: e.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="initial_calf">Calf</Label><Input id="initial_calf" type="number" step="0.1" min="0" value={formData.initial_calf} onChange={(e) => setFormData({ ...formData, initial_calf: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="initial_measurement_notes">Measurement Notes</Label>
                <Textarea id="initial_measurement_notes" value={formData.initial_measurement_notes} onChange={(e) => setFormData({ ...formData, initial_measurement_notes: e.target.value })} rows={3} placeholder="Optional notes for the first measurement record" />
              </div>
            </div>
          )}

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

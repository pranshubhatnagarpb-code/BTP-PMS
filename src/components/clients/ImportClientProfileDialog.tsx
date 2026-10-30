// Import a client profile from an already-filled assessment form (Word / PDF),
// without AI. The form's answers fill the profile (editable here before saving)
// and are kept in full as the client's assessment form record (eye icon).
import { useMemo, useRef, useState } from 'react';
import { FileUp, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json, TablesUpdate } from '@/integrations/supabase/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClients, type Client } from '@/hooks/useClients';
import type { AssessmentProfile, ImportedAssessment } from '@/lib/assessmentImport';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NONE = 'none';
const DIET_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'non-vegetarian', label: 'Non-Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'eggetarian', label: 'Eggetarian' },
];
const GOAL_OPTIONS = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'weight_gain', label: 'Weight Gain' },
  { value: 'maintain', label: 'Maintain Weight' },
  { value: 'muscle_building', label: 'Muscle Building' },
  { value: 'disease_management', label: 'Disease Management' },
];

const lastDigits = (p?: string | null) => (p || '').replace(/\D/g, '').slice(-10);

export const ImportClientProfileDialog = ({ open, onOpenChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { data: clients = [] } = useClients();
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState('');
  const [imported, setImported] = useState<ImportedAssessment | null>(null);
  const [profile, setProfile] = useState<AssessmentProfile | null>(null);
  // 'new' or the id of the existing client to update.
  const [target, setTarget] = useState('new');

  const reset = () => {
    setFileName('');
    setImported(null);
    setProfile(null);
    setTarget('new');
    if (inputRef.current) inputRef.current.value = '';
  };
  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  // Existing clients with the same phone or email: update instead of adding twice.
  const matches = useMemo(() => {
    if (!profile) return [];
    const phone = lastDigits(profile.phone);
    const email = profile.email.trim().toLowerCase();
    return (clients as Client[]).filter(
      (c) => (phone.length === 10 && lastDigits(c.phone) === phone) || (email && (c.email || '').trim().toLowerCase() === email),
    );
  }, [clients, profile]);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (/\.doc$/i.test(file.name)) {
      toast.error('Old Word (.doc) files can’t be read', { description: 'Save it as .docx or PDF in Word, then import that.' });
      return;
    }
    setReading(true);
    setFileName(file.name);
    setImported(null);
    setProfile(null);
    try {
      const { readAssessmentFile } = await import('@/lib/assessmentImport');
      const result = await readAssessmentFile(file);
      if (!result.profile.name || result.answerCount < 3) {
        toast.error('This doesn’t look like a filled assessment form', {
          description: 'No client name or answers were found in its tables.',
        });
        return;
      }
      setImported(result);
      setProfile(result.profile);
      const phone = lastDigits(result.profile.phone);
      const email = result.profile.email;
      const match = (clients as Client[]).find(
        (c) => (phone.length === 10 && lastDigits(c.phone) === phone) || (email && (c.email || '').toLowerCase() === email),
      );
      setTarget(match ? match.id : 'new');
    } catch (e) {
      toast.error('Could not read this file', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setReading(false);
    }
  };

  const set = <K extends keyof AssessmentProfile>(key: K, value: AssessmentProfile[K] | string) =>
    setProfile((p) => (p ? { ...p, [key]: value } : p));

  const save = async () => {
    if (!profile || !imported) return;
    if (!profile.name.trim()) {
      toast.error('Client name is required');
      return;
    }
    setSaving(true);
    try {
      const fields = {
        name: profile.name.trim(),
        phone: profile.phone.trim() || null,
        email: profile.email.trim() || null,
        address: profile.address.trim() || null,
        date_of_birth: profile.date_of_birth || null,
        gender: profile.gender || null,
        height: profile.height,
        weight: profile.weight,
        diet_preference: profile.diet_preference || null,
        goal: profile.goal || null,
        health_conditions: profile.health_conditions,
        supplements: profile.supplements.trim() || null,
        notes: profile.notes.trim() || null,
      };

      let clientId: string;
      let clientName = fields.name;
      if (target === 'new') {
        // client_code is assigned by the database.
        const { data, error } = await supabase.from('clients').insert(fields).select('id, name').single();
        if (error) throw error;
        clientId = data.id;
      } else {
        // Existing client: fill what's empty, add new conditions, keep everything already there.
        const { data: existing, error: readError } = await supabase.from('clients').select('*').eq('id', target).single();
        if (readError) throw readError;
        const update: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fields)) {
          if (key === 'health_conditions' || key === 'notes' || key === 'supplements' || key === 'name') continue;
          const current = (existing as Record<string, unknown>)[key];
          if ((current === null || current === '' || current === undefined) && value !== null && value !== '') update[key] = value;
        }
        const conditions = [...new Set([...(existing.health_conditions || []), ...fields.health_conditions])];
        if (conditions.length !== (existing.health_conditions || []).length) update.health_conditions = conditions;
        for (const key of ['supplements', 'notes'] as const) {
          const current = (existing[key] || '').trim();
          const incoming = fields[key];
          if (incoming && !current.includes(incoming)) update[key] = current ? `${current}\n\n${incoming}` : incoming;
        }
        if (Object.keys(update).length) {
          const { error } = await supabase.from('clients').update(update as TablesUpdate<'clients'>).eq('id', target);
          if (error) throw error;
        }
        clientId = target;
        clientName = existing.name;
      }

      // The full form, shown with the client's assessment form (eye icon).
      const { error: intakeError } = await supabase.from('intake_submissions').insert({
        branch: profile.gender === 'male' ? 'male' : 'female',
        age: profile.age,
        dob: profile.date_of_birth || null,
        full_name: fields.name,
        phone: fields.phone,
        email: fields.email,
        payload: {
          source: `Imported from ${fileName}`,
          contact: { name: fields.name, phone: fields.phone, email: fields.email, gender: profile.gender || undefined },
          ...imported.sections,
        } as unknown as Json,
        pms_lead_id: clientId,
        pms_status: 'sent',
        pms_sent_at: new Date().toISOString(),
      });

      qc.invalidateQueries({ queryKey: ['clients'] });
      qc.invalidateQueries({ queryKey: ['clients-with-diet-data'] });
      qc.invalidateQueries({ queryKey: ['intake-submissions', clientId] });
      if (intakeError) {
        toast.warning(`${clientName} saved, but the full form answers weren't`, {
          description: /row-level security|policy/i.test(intakeError.message)
            ? 'Run the migration 20261030010000_staff_import_intake_submissions.sql, then import the form again.'
            : intakeError.message,
        });
      } else {
        toast.success(target === 'new' ? `${clientName} added from the assessment form` : `${clientName} updated from the assessment form`);
      }
      handleOpenChange(false);
    } catch (e) {
      toast.error('Could not save the client', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof AssessmentProfile, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={(profile?.[key] as string | number | null) ?? ''}
        onChange={(e) =>
          set(key, props.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) as never : e.target.value)
        }
        {...props}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Import client profile</DialogTitle>
          <DialogDescription>
            Choose a filled assessment form (Word .docx or PDF). The details are read from the form without AI. For
            tick-box questions, the options marked in bold or ticked are taken as the answers. Check the details below before
            saving.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 space-y-4 overflow-y-auto px-6">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <Button variant="outline" className="w-full justify-start" disabled={reading} onClick={() => inputRef.current?.click()}>
            {reading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
            <span className="truncate">{reading ? `Reading ${fileName}…` : fileName || 'Choose assessment form'}</span>
          </Button>

          {profile && imported && (
            <>
              {matches.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
                  <p className="mb-2 font-medium">Already in your clients (same phone or email):</p>
                  <RadioGroup value={target} onValueChange={setTarget} className="space-y-1">
                    {matches.map((c) => (
                      <label key={c.id} className="flex items-center gap-2">
                        <RadioGroupItem value={c.id} />
                        Update {c.name}
                        {c.client_code ? <span className="text-muted-foreground">({c.client_code})</span> : null}
                        <span className="text-xs text-muted-foreground">— fills empty fields only</span>
                      </label>
                    ))}
                    <label className="flex items-center gap-2">
                      <RadioGroupItem value="new" />
                      Add as a new client
                    </label>
                  </RadioGroup>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {field('name', 'Name')}
                {field('phone', 'Phone')}
                {field('email', 'Email')}
                {field('date_of_birth', `Date of birth${imported.raw.dob ? ` (form: ${imported.raw.dob})` : ''}`, { type: 'date' })}
                <div className="space-y-1">
                  <Label className="text-xs">Gender</Label>
                  <Select value={profile.gender || NONE} onValueChange={(v) => set('gender', v === NONE ? '' : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not given</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Diet preference</Label>
                  <Select value={profile.diet_preference || NONE} onValueChange={(v) => set('diet_preference', v === NONE ? '' : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not given</SelectItem>
                      {DIET_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {field('height', `Height (cm)${imported.raw.height ? ` — form: ${imported.raw.height}` : ''}`, { type: 'number', step: '0.1' })}
                {field('weight', `Weight (kg)${imported.raw.weight ? ` — form: ${imported.raw.weight}` : ''}`, { type: 'number', step: '0.1' })}
                <div className="space-y-1">
                  <Label className="text-xs">Goal</Label>
                  <Select value={profile.goal || NONE} onValueChange={(v) => set('goal', v === NONE ? '' : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not set</SelectItem>
                      {GOAL_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {field('address', 'Address')}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Health conditions</Label>
                {profile.health_conditions.length ? (
                  <div className="flex flex-wrap gap-1">
                    {profile.health_conditions.map((c) => (
                      <Badge key={c} variant="secondary" className="gap-1 font-normal">
                        {c}
                        <button
                          type="button"
                          aria-label={`Remove ${c}`}
                          onClick={() => set('health_conditions', profile.health_conditions.filter((x) => x !== c) as never)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">None marked on the form</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Medicines & supplements</Label>
                <Textarea rows={2} value={profile.supplements} onChange={(e) => set('supplements', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes (goals, requests, recent tests, aversions)</Label>
                <Textarea rows={3} value={profile.notes} onChange={(e) => set('notes', e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                All {imported.answerCount} answers (lifestyle, exercise, 24-hour diet recall and more) are also saved with the
                client. To see them, click the eye icon next to the client's name.
              </p>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button className="gradient-primary text-primary-foreground" disabled={!profile || saving} onClick={save}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {target === 'new' ? 'Add client' : 'Update client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

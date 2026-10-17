// Edit and delete actions for an appointment. Both are mirrored to the
// appointment's Zoho Calendar event.
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Appointment } from '@/hooks/useAppointments';
import { useDeleteAppointment, useUpdateAppointment } from '@/hooks/useAppointments';
import {
  APPOINTMENT_TYPE_LABELS,
  SELECTABLE_APPOINTMENT_TYPES,
  DURATION_OPTIONS,
  DEFAULT_DURATION,
  formatDuration,
  ClinicLocation,
  MEETING_MODE_LABELS,
  MeetingMode,
  isOnlineMode,
  needsClinicLocation,
} from '@/lib/appointmentOutcomes';
import { AppointmentColor, autoColor } from '@/lib/appointmentColors';
import { AppointmentColorPicker } from './AppointmentColorPicker';
import { clinic } from '@/config/clinic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

// Everything but the date / time, which Reschedule handles so it's kept in history.
export const EditAppointmentDialog = ({ appointment }: { appointment: Appointment }) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [meetingMode, setMeetingMode] = useState<MeetingMode>('online');
  const [clinicLocation, setClinicLocation] = useState<ClinicLocation | ''>('');
  const [color, setColor] = useState<AppointmentColor | null>(null);
  const [notes, setNotes] = useState('');
  const updateAppointment = useUpdateAppointment();

  const clinicRequired = needsClinicLocation(meetingMode);
  const canSave = !clinicRequired || Boolean(clinicLocation);
  // Keep a length set elsewhere (e.g. resized in Zoho) selectable.
  const durationOptions = DURATION_OPTIONS.includes(duration as (typeof DURATION_OPTIONS)[number])
    ? [...DURATION_OPTIONS]
    : [...DURATION_OPTIONS, duration].sort((a, b) => a - b);
  // Older appointments may have a type that's no longer offered for new bookings.
  const typeOptions: string[] = (SELECTABLE_APPOINTMENT_TYPES as readonly string[]).includes(type)
    ? [...SELECTABLE_APPOINTMENT_TYPES]
    : [...SELECTABLE_APPOINTMENT_TYPES, type];

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setTitle(appointment.title ?? '');
      setType(appointment.appointment_type);
      setDuration(appointment.duration_minutes || DEFAULT_DURATION);
      setMeetingMode(appointment.meeting_mode);
      setClinicLocation(appointment.clinic_location ?? '');
      setColor(appointment.color);
      setNotes(appointment.notes ?? '');
    }
    setOpen(next);
  };

  const handleSave = () => {
    if (!canSave) return;
    updateAppointment.mutate(
      {
        id: appointment.id,
        title: title.trim() || null,
        appointment_type: type,
        duration_minutes: duration,
        meeting_mode: meetingMode,
        clinic_location: clinicRequired && clinicLocation ? clinicLocation : null,
        color,
        notes: notes.trim() || null,
      },
      { onSuccess: () => setOpen(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-muted-foreground hover:text-foreground">
          <Pencil className="h-4 w-4 mr-1" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md flex max-h-[90vh] flex-col">
        <DialogHeader>
          <DialogTitle>Edit Appointment</DialogTitle>
        </DialogHeader>
        <div className="-mx-6 space-y-4 overflow-y-auto px-6 pb-1">
          <div className="space-y-2">
            <Label htmlFor="appointment-title">Title</Label>
            <Input
              id="appointment-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`${APPOINTMENT_TYPE_LABELS[type] ?? type} — ${appointment.clients?.name ?? 'Client'}`}
            />
            <p className="text-xs text-muted-foreground">Leave empty to use the default title.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((value) => (
                    <SelectItem key={value} value={value}>{APPOINTMENT_TYPE_LABELS[value] ?? value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durationOptions.map((m) => (
                    <SelectItem key={m} value={String(m)}>{formatDuration(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Meeting Mode</Label>
            <Select value={meetingMode} onValueChange={(v) => setMeetingMode(v as MeetingMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MEETING_MODE_LABELS) as MeetingMode[]).map((m) => (
                  <SelectItem key={m} value={m}>{MEETING_MODE_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isOnlineMode(meetingMode) && !isOnlineMode(appointment.meeting_mode) && (
              <p className="text-xs text-muted-foreground">
                Use Generate Link afterwards to add a Zoho Meeting link.
              </p>
            )}
          </div>

          {clinicRequired && (
            <div className="space-y-2">
              <Label>Clinic Location *</Label>
              <Select value={clinicLocation} onValueChange={(v) => setClinicLocation(v as ClinicLocation)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select clinic" />
                </SelectTrigger>
                <SelectContent>
                  {clinic.addresses.map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <AppointmentColorPicker
            value={color}
            autoValue={autoColor({ appointment_type: type, meeting_mode: meetingMode, clinic_location: clinicRequired ? clinicLocation || null : null })}
            onChange={setColor}
          />

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
          </div>

          <p className="text-xs text-muted-foreground">
            Changes are copied to the Zoho Calendar event. To change the date or time, use Reschedule.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={!canSave || updateAppointment.isPending}>
            {updateAppointment.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const DeleteAppointmentButton = ({ appointment, onDeleted }: { appointment: Appointment; onDeleted?: () => void }) => {
  const deleteAppointment = useDeleteAppointment();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this appointment?</AlertDialogTitle>
          <AlertDialogDescription>
            {appointment.clients?.name ?? 'This client'}'s appointment and its Zoho Calendar event will be removed
            permanently, including its reschedule history. To keep a record instead, use Cancel.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => deleteAppointment.mutate(appointment.id, { onSuccess: onDeleted })}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

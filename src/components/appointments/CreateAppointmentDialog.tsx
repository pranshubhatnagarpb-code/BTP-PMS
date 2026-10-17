import { useEffect, useState } from 'react';
import { addMinutes, format, parse } from 'date-fns';
import { CalendarIcon, Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useActiveClients } from '@/hooks/useClients';
import { useCreateAppointment } from '@/hooks/useAppointments';
import type { ZohoExternalEvent } from '@/hooks/useZohoCalendar';
import { APPOINTMENT_TYPE_LABELS, SELECTABLE_APPOINTMENT_TYPES, DURATION_OPTIONS, DEFAULT_DURATION, DEFAULT_DURATION_BY_TYPE, formatDuration, ClinicLocation, MEETING_MODE_LABELS, MeetingMode, isOnlineMode, needsClinicLocation, overlappingBlocks } from '@/lib/appointmentOutcomes';
import { AppointmentColor, autoColor } from '@/lib/appointmentColors';
import { AppointmentColorPicker } from './AppointmentColorPicker';
import { clinic } from '@/config/clinic';

// East first, as staff refer to them.
const CLINIC_OPTIONS = [...clinic.addresses].sort((a, b) => a.label.localeCompare(b.label));

interface Props {
  trigger?: React.ReactNode;
  // Controlled use (e.g. "Add to PMS" on a Zoho meeting); no trigger is rendered.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  // A meeting already booked in Zoho Calendar: its slot is prefilled and kept,
  // and the appointment is linked to that event instead of creating another.
  zohoEvent?: ZohoExternalEvent | null;
}

export const CreateAppointmentDialog = ({ trigger, open: controlledOpen, onOpenChange, zohoEvent }: Props) => {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (next: boolean) => {
    setInnerOpen(next);
    onOpenChange?.(next);
  };
  // More than one client books a shared slot, e.g. a couple coming together.
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [date, setDate] = useState<Date>();
  const [time, setTime] = useState('10:00');
  const [type, setType] = useState('consultation');
  const [duration, setDuration] = useState(DEFAULT_DURATION_BY_TYPE.consultation);
  const [meetingMode, setMeetingMode] = useState<MeetingMode>('online');
  const [clinicLocation, setClinicLocation] = useState<ClinicLocation | ''>('');
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<AppointmentColor | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !zohoEvent?.time) return;
    setClientIds([]);
    setDate(new Date(`${zohoEvent.date}T00:00:00`));
    setTime(zohoEvent.time.slice(0, 5));
    setDuration(zohoEvent.duration || DEFAULT_DURATION);
    setTitle(zohoEvent.title === '(No title)' ? '' : zohoEvent.title);
    setNotes(zohoEvent.description?.trim() ?? '');
    if (zohoEvent.meetLink) setMeetingMode('online');
  }, [open, zohoEvent]);
  const linking = Boolean(zohoEvent?.time);
  // A Zoho meeting can run any length; keep it selectable.
  const durationOptions: number[] = (DURATION_OPTIONS as readonly number[]).includes(duration)
    ? [...DURATION_OPTIONS]
    : [...DURATION_OPTIONS, duration].sort((a, b) => a - b);

  const { data: clients = [] } = useActiveClients();
  const createAppointment = useCreateAppointment();

  const clinicRequired = needsClinicLocation(meetingMode);
  const canSubmit = Boolean(clientIds.length && date && time && (!clinicRequired || clinicLocation) && (!linking || clientIds.length === 1));

  // Picking a type resets the length to that type's usual call length.
  const handleTypeChange = (value: string) => {
    setType(value);
    setDuration(DEFAULT_DURATION_BY_TYPE[value] ?? DEFAULT_DURATION);
  };

  const endTime = time ? format(addMinutes(parse(time, 'HH:mm', new Date()), duration), 'h:mm a') : '';
  const startMinutes = time ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)) : null;
  const clashes = startMinutes === null ? [] : overlappingBlocks(startMinutes, duration);

  const toggleClient = (id: string) =>
    setClientIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const handleSubmit = () => {
    if (!canSubmit || !date) return;

    createAppointment.mutate(
      {
        client_ids: clientIds,
        appointment_date: format(date, 'yyyy-MM-dd'),
        appointment_time: time,
        appointment_type: type,
        duration_minutes: duration,
        title: title.trim() || null,
        meeting_mode: meetingMode,
        clinic_location: clinicRequired && clinicLocation ? clinicLocation : null,
        color,
        notes: notes || undefined,
        zohoEvent: linking && zohoEvent ? { uid: zohoEvent.uid, calendarUid: zohoEvent.calendarUid, meetLink: zohoEvent.meetLink } : undefined,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setClientIds([]);
          setDate(undefined);
          setTime('10:00');
          setType('consultation');
          setDuration(DEFAULT_DURATION_BY_TYPE.consultation);
          setMeetingMode('online');
          setClinicLocation('');
          setTitle('');
          setColor(null);
          setNotes('');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          {trigger || (
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Create Appointment
            </Button>
          )}
        </DialogTrigger>
      )}
      {/* Capped to the viewport: the fields scroll, the Create button stays visible. */}
      <DialogContent className="sm:max-w-md flex max-h-[90vh] flex-col">
        <DialogHeader>
          <DialogTitle>{linking ? 'Add Zoho Meeting to PMS' : 'Create Appointment'}</DialogTitle>
        </DialogHeader>
        <div className="-mx-6 mt-2 space-y-4 overflow-y-auto px-6 pb-1">
          {linking && (
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Booked in Zoho Calendar: <span className="font-medium text-foreground">{zohoEvent?.title}</span>. Pick the
              client — the appointment is linked to this Zoho event (no new event is created). Date and time stay as
              booked; reschedule after adding to change them.
            </p>
          )}
          {/* Client */}
          <div className="space-y-2">
            <Label>Client(s) *</Label>
            <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen} modal>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn('w-full justify-between font-normal', !clientIds.length && 'text-muted-foreground')}
                >
                  {clientIds.length === 0
                    ? 'Select client(s)'
                    : clientIds.length === 1
                      ? clients.find((c) => c.id === clientIds[0])?.name ?? '1 client selected'
                      : `${clientIds.length} clients selected`}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search clients..." />
                  <CommandList className="max-h-[260px]">
                    <CommandEmpty>No client found.</CommandEmpty>
                    <CommandGroup>
                      {clients.map((c) => (
                        <CommandItem key={c.id} value={`${c.name} ${c.id}`} onSelect={() => toggleClient(c.id)}>
                          <Check className={cn('mr-2 h-4 w-4', clientIds.includes(c.id) ? 'opacity-100' : 'opacity-0')} />
                          {c.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {clientIds.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {clientIds.map((id) => (
                  <Badge key={id} variant="secondary" className="gap-1 pr-1">
                    {clients.find((c) => c.id === id)?.name ?? 'Client'}
                    <button type="button" onClick={() => toggleClient(id)} aria-label="Remove client" className="rounded-sm hover:bg-muted-foreground/20">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {linking
                ? 'Pick one client — a Zoho meeting links to a single appointment.'
                : 'Select more than one for clients coming together — each gets their own appointment at the same time.'}
            </p>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  disabled={linking}
                  className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time + duration */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Time *</Label>
              <Input type="time" value={time} disabled={linking} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Duration *</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))} disabled={linking}>
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
            {endTime && (
              <p className="col-span-2 -mt-1 text-xs text-muted-foreground">
                Ends at {endTime} — Zoho Calendar is blocked for this whole slot.
              </p>
            )}
            {clashes.length > 0 && (
              <p className="col-span-2 -mt-1 text-xs text-amber-600 dark:text-amber-400">
                Overlaps the daily block{clashes.length > 1 ? 's' : ''}: {clashes.map((b) => `${b.label} (${format(new Date(2000, 0, 1, 0, b.start), 'h:mm')}–${format(new Date(2000, 0, 1, 0, b.end), 'h:mm a')})`).join(', ')}.
              </p>
            )}
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SELECTABLE_APPOINTMENT_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>{APPOINTMENT_TYPE_LABELS[value]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Meeting mode */}
          <div className="space-y-2">
            <Label>Meeting Mode *</Label>
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
            <p className="text-xs text-muted-foreground">
              {isOnlineMode(meetingMode)
                ? 'A Zoho Meeting link is created and added to Zoho Calendar.'
                : 'In person — added to Zoho Calendar without a meeting link.'}
            </p>
          </div>

          {/* Clinic location, for in-person appointments */}
          {clinicRequired && (
            <div className="space-y-2">
              <Label>Clinic Location *</Label>
              <Select value={clinicLocation} onValueChange={(v) => setClinicLocation(v as ClinicLocation)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select clinic" />
                </SelectTrigger>
                <SelectContent>
                  {CLINIC_OPTIONS.map((c) => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clinicLocation && (
                <p className="text-xs text-muted-foreground">
                  {CLINIC_OPTIONS.find((c) => c.key === clinicLocation)?.address}
                </p>
              )}
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Optional — defaults to "${APPOINTMENT_TYPE_LABELS[type]} — <client name>"`}
            />
            <p className="text-xs text-muted-foreground">Used as the Zoho Calendar event title.</p>
          </div>

          {/* Calendar colour */}
          <AppointmentColorPicker
            value={color}
            autoValue={autoColor({ appointment_type: type, meeting_mode: meetingMode, clinic_location: clinicRequired ? clinicLocation || null : null })}
            onChange={setColor}
          />

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
          </div>

        </div>
        <Button className="w-full shrink-0" onClick={handleSubmit} disabled={!canSubmit || createAppointment.isPending}>
          {createAppointment.isPending ? 'Creating...' : linking ? 'Add to PMS' : clientIds.length > 1 ? `Create ${clientIds.length} Appointments` : 'Create Appointment'}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

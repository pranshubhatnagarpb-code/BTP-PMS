// Zoho-style time-grid calendar for appointments, with Day and Week views.
// Each appointment is drawn as a block at its start time; clicking one opens
// its details along with the same actions as the list view. Clicking an empty
// slot or a daily block opens Create Appointment at that time. Appointments and
// daily blocks can be dragged up / down to change their time (same day).
import { ReactNode, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import { addDays, addWeeks, format, isSameDay, isToday, parseISO, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Coffee, Pencil } from 'lucide-react';
import { useRescheduleAppointment, type Appointment } from '@/hooks/useAppointments';
import { APPOINTMENT_TYPE_LABELS, DEFAULT_DURATION, MEETING_MODE_LABELS, OUTCOME_LABELS, blocksOnWeekday, formatDuration, minutesToTime } from '@/lib/appointmentOutcomes';
import {
  blocksForDate,
  useBlockOverrides,
  useRecurringBlocks,
  useResetDayBlocks,
  useSaveDayBlocks,
  type DayBlock,
} from '@/hooks/useRecurringBlocks';
import { RecurringBlocksDialog } from './RecurringBlocksDialog';
import { CreateAppointmentDialog } from './CreateAppointmentDialog';
import { APPOINTMENT_COLORS, BLOCK_COLOR, COLOR_LEGEND, colorOf } from '@/lib/appointmentColors';
import { clinic } from '@/config/clinic';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type CalendarView = 'day' | 'week';

const HOUR_HEIGHT = 64; // px per hour
// The grid opens framed on 10 am – 7 pm, when most appointments happen.
const VISIBLE_FROM_HOUR = 10;
const VISIBLE_TO_HOUR = 19;

// Dragging: moves snap to this many minutes; under this many pixels it's a click.
const SNAP_MINUTES = 15;
const DRAG_THRESHOLD_PX = 4;
// Dragging this close to the top / bottom of the grid scrolls it.
const AUTO_SCROLL_EDGE_PX = 32;
const AUTO_SCROLL_STEP_PX = 16;

interface DragState {
  key: string;
  startY: number;
  startScroll: number;
  origin: number;
  duration: number;
  current: number;
  moved: boolean;
}

const sameDayBlocks = (a: DayBlock[], b: DayBlock[]) => {
  const norm = (list: DayBlock[]) => JSON.stringify([...list].sort((x, y) => x.start - y.start).map((x) => [x.label, x.start, x.end]));
  return norm(a) === norm(b);
};

const INACTIVE_COLOR = 'border-l-muted-foreground/40 bg-muted text-muted-foreground line-through';

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const durationOf = (apt: Appointment) => apt.duration_minutes || DEFAULT_DURATION;

const formatTime = (minutes: number) =>
  format(new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60), 'h:mm a');

type GridItem = { apt: Appointment; start: number; duration: number };

// Side-by-side lanes for overlapping appointments within one day, like Zoho.
const layoutDay = (list: GridItem[]) => {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const placed: (GridItem & { lane: number; lanes: number })[] = [];
  let cluster: typeof placed = [];
  let clusterEnd = -1;
  const closeCluster = () => {
    const lanes = Math.max(1, ...cluster.map((p) => p.lane + 1));
    cluster.forEach((p) => { p.lanes = lanes; });
    cluster = [];
  };
  for (const entry of sorted) {
    if (entry.start >= clusterEnd) closeCluster();
    const laneEnds: number[] = [];
    cluster.forEach((p) => { laneEnds[p.lane] = Math.max(laneEnds[p.lane] ?? 0, p.start + p.duration); });
    let lane = laneEnds.findIndex((end) => end <= entry.start);
    if (lane === -1) lane = laneEnds.length;
    const item = { ...entry, lane, lanes: 1 };
    cluster.push(item);
    placed.push(item);
    clusterEnd = Math.max(clusterEnd, entry.start + entry.duration);
  }
  closeCluster();
  return placed;
};

interface Props {
  appointments: Appointment[];
  renderMeeting: (apt: Appointment) => ReactNode;
  renderActions: (apt: Appointment) => ReactNode;
}

export const AppointmentsCalendar = ({ appointments, renderMeeting, renderActions }: Props) => {
  const [view, setView] = useState<CalendarView>('week');
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  // null = closed; 'usual' = the every-day blocks; a Date = that date's blocks only.
  const [editingBlocks, setEditingBlocks] = useState<'usual' | Date | null>(null);
  // A clicked slot: Create Appointment opens on it.
  const [newSlot, setNewSlot] = useState<{ date: Date; time: string } | null>(null);
  const { blocks } = useRecurringBlocks();
  const scrollRef = useRef<HTMLDivElement>(null);
  const reschedule = useRescheduleAppointment();
  const saveDayBlocks = useSaveDayBlocks();
  const resetDayBlocks = useResetDayBlocks();

  // ---- drag to change time ----
  const [drag, setDrag] = useState<DragState | null>(null);
  // Where a dropped item shows until its save finishes, so it doesn't jump back.
  const [pending, setPending] = useState<Record<string, number>>({});
  // A drag ends with a click event; this swallows it.
  const justDragged = useRef(false);

  const startOf = (key: string, start: number) =>
    drag?.key === key && drag.moved ? drag.current : pending[key] ?? start;

  const beginDrag = (e: ReactPointerEvent<HTMLElement>, key: string, origin: number, duration: number) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ key, startY: e.clientY, startScroll: scrollRef.current?.scrollTop ?? 0, origin, duration, current: origin, moved: false });
  };

  const moveDrag = (e: ReactPointerEvent<HTMLElement>) => {
    if (!drag) return;
    const grid = scrollRef.current;
    if (grid && drag.moved) {
      const rect = grid.getBoundingClientRect();
      if (e.clientY < rect.top + AUTO_SCROLL_EDGE_PX) grid.scrollTop -= AUTO_SCROLL_STEP_PX;
      else if (e.clientY > rect.bottom - AUTO_SCROLL_EDGE_PX) grid.scrollTop += AUTO_SCROLL_STEP_PX;
    }
    const dy = e.clientY - drag.startY + ((grid?.scrollTop ?? 0) - drag.startScroll);
    if (!drag.moved && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
    const delta = Math.round(((dy / HOUR_HEIGHT) * 60) / SNAP_MINUTES) * SNAP_MINUTES;
    const current = Math.min(Math.max(drag.origin + delta, 0), 24 * 60 - drag.duration);
    if (!drag.moved || current !== drag.current) setDrag({ ...drag, moved: true, current });
  };

  const endDrag = (onDrop: (newStart: number) => void) => () => {
    if (!drag) return;
    const finished = drag;
    setDrag(null);
    if (!finished.moved) return;
    justDragged.current = true;
    setTimeout(() => { justDragged.current = false; }, 0);
    if (finished.current !== finished.origin) onDrop(finished.current);
  };

  const clearPending = (key: string) =>
    setPending((p) => {
      const next = { ...p };
      delete next[key];
      return next;
    });

  const moveAppointment = (apt: Appointment, newStart: number, isUndo = false) => {
    const key = `apt:${apt.id}`;
    setPending((p) => ({ ...p, [key]: newStart }));
    const previousStart = minutesOf(apt.appointment_time);
    reschedule.mutate(
      {
        id: apt.id,
        previousDate: apt.appointment_date,
        previousTime: apt.appointment_time,
        newDate: apt.appointment_date,
        newTime: minutesToTime(newStart),
      },
      {
        onSuccess: () => {
          if (isUndo) return;
          toast(`${apt.clients?.name ?? 'Appointment'} moved to ${formatTime(newStart)}`, {
            action: {
              label: 'Undo',
              onClick: () => moveAppointment({ ...apt, appointment_time: `${minutesToTime(newStart)}:00` }, previousStart, true),
            },
          });
        },
        onError: () => clearPending(key),
      },
    );
  };

  // Moving a block on the calendar changes that date only (like editing it there).
  // Back to exactly the usual blocks: drop the date's own list rather than copy them
  // (resetting a date without its own blocks is harmless).
  const saveBlocksForDay = (day: Date, next: DayBlock[], onError?: () => void) => {
    if (sameDayBlocks(next, blocksOnWeekday(blocks, day.getDay()))) resetDayBlocks.mutate(day, { onError });
    else saveDayBlocks.mutate({ date: day, blocks: next }, { onError });
  };

  const moveBlock = (day: Date, dayBlocks: DayBlock[], index: number, newStart: number) => {
    const key = `block:${format(day, 'yyyy-MM-dd')}:${index}`;
    setPending((p) => ({ ...p, [key]: newStart }));
    const before = dayBlocks;
    const moved = dayBlocks.map((b, i) => (i === index ? { ...b, start: newStart, end: newStart + (b.end - b.start) } : b));
    saveBlocksForDay(day, moved, () => clearPending(key));
    toast(`${before[index].label} moved to ${formatTime(newStart)} on ${format(day, 'EEE, d MMM')} only`, {
      action: { label: 'Undo', onClick: () => saveBlocksForDay(day, before) },
    });
  };

  // The time under the pointer in a day column, rounded down to the snap step.
  const openCreateAt = (e: ReactMouseEvent<HTMLElement>, day: Date) => {
    const column = (e.currentTarget as HTMLElement).closest('[data-day-column]');
    if (!column) return;
    const y = e.clientY - column.getBoundingClientRect().top;
    const minutes = Math.floor(((y / HOUR_HEIGHT) * 60) / SNAP_MINUTES) * SNAP_MINUTES;
    setNewSlot({ date: day, time: minutesToTime(Math.min(Math.max(minutes, 0), 24 * 60 - SNAP_MINUTES)) });
  };

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = VISIBLE_FROM_HOUR * HOUR_HEIGHT;
  }, []);

  const days = useMemo(() => {
    if (view === 'day') return [anchor];
    const start = startOfWeek(anchor, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [view, anchor]);

  // Dates in view that have their own blocks (one-off changes).
  const { overrides } = useBlockOverrides(days[0], days[days.length - 1]);

  // Fresh appointments / blocks have arrived, so dropped items show their saved place.
  useEffect(() => setPending({}), [appointments, overrides]);

  const byDay = useMemo(
    () => days.map((day) => layoutDay(
      appointments
        .filter((a) => isSameDay(parseISO(a.appointment_date), day))
        .map((apt) => ({ apt, start: minutesOf(apt.appointment_time), duration: durationOf(apt) })),
    )),
    [days, appointments],
  );

  // Looked up by id so the details stay current after a reschedule / outcome.
  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  const step = (dir: 1 | -1) => setAnchor((d) => (view === 'day' ? addDays(d, dir) : addWeeks(d, dir)));

  const rangeLabel = view === 'day'
    ? format(anchor, 'EEEE, d MMM yyyy')
    : format(days[0], 'MMM') === format(days[6], 'MMM')
      ? `${format(days[0], 'd')} – ${format(days[6], 'd MMM yyyy')}`
      : `${format(days[0], 'd MMM')} – ${format(days[6], 'd MMM yyyy')}`;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="rounded-lg border bg-card">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Today</Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => step(-1)} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => step(1)} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-base font-semibold">{rangeLabel}</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
            {COLOR_LEGEND.map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1">
                <span className={cn('h-2.5 w-2.5 rounded-sm', APPOINTMENT_COLORS[color].swatch)} />
                {label}
              </span>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditingBlocks('usual')} title="Edit the blocks shown on every day">
            <Coffee className="h-4 w-4 mr-1" /> Daily blocks
          </Button>
          <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setView(v as CalendarView)}>
            <ToggleGroupItem value="day">Day</ToggleGroupItem>
            <ToggleGroupItem value="week">Week</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className={cn(view === 'week' && 'min-w-[760px]')}>
          {/* Day headers */}
          <div className="flex border-b">
            <div className="w-16 shrink-0 py-2 text-center text-[10px] text-muted-foreground">IST</div>
            {days.map((day) => (
              <div key={day.toISOString()} className="flex-1 border-l py-2 text-center">
                <button
                  type="button"
                  className={cn(
                    'inline-flex items-baseline gap-1.5 rounded px-2 hover:bg-muted',
                    isToday(day) ? 'text-primary font-semibold' : 'text-foreground',
                  )}
                  onClick={() => { setAnchor(day); setView('day'); }}
                  title="Open day view"
                >
                  <span className="text-lg">{format(day, 'd')}</span>
                  <span className="text-sm">{format(day, 'EEE')}</span>
                </button>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div
            ref={scrollRef}
            className="relative overflow-y-auto"
            style={{ maxHeight: (VISIBLE_TO_HOUR - VISIBLE_FROM_HOUR) * HOUR_HEIGHT }}
          >
            <div className="flex" style={{ height: 24 * HOUR_HEIGHT }}>
              <div className="relative w-16 shrink-0">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="absolute right-2 -translate-y-1/2 text-xs text-muted-foreground" style={{ top: h * HOUR_HEIGHT }}>
                    {h === 0 ? '' : format(new Date(2000, 0, 1, h), 'h a')}
                  </div>
                ))}
              </div>

              {days.map((day, i) => (
                <div
                  key={day.toISOString()}
                  data-day-column
                  className="relative flex-1 cursor-pointer border-l"
                  onClick={(e) => openCreateAt(e, day)}
                  title={`Click to create an appointment on ${format(day, 'EEE, d MMM')}`}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="border-b border-border/60" style={{ height: HOUR_HEIGHT }}>
                      <div className="h-1/2 border-b border-dashed border-border/30" />
                    </div>
                  ))}

                  {blocksForDate(day, blocks, overrides).map((b, bi, dayBlocks) => {
                    const key = `block:${format(day, 'yyyy-MM-dd')}:${bi}`;
                    const length = b.end - b.start;
                    const top = startOf(key, b.start);
                    const dragging = drag?.key === key && drag.moved;
                    return (
                      <button
                        key={`${b.start}-${b.end}-${b.label}`}
                        type="button"
                        onPointerDown={(e) => beginDrag(e, key, b.start, length)}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag((newStart) => moveBlock(day, dayBlocks, bi, newStart))}
                        onPointerCancel={() => setDrag(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!justDragged.current) openCreateAt(e, day);
                        }}
                        title={`${b.label} — click to create an appointment, drag to move, pencil to edit ${format(day, 'EEE, d MMM')}'s blocks`}
                        className={cn(
                          'absolute inset-x-0 touch-none select-none overflow-hidden border-l-4 px-1.5 py-0.5 text-left text-[11px] leading-tight opacity-70 hover:opacity-90',
                          dragging ? 'z-30 cursor-grabbing opacity-90 shadow-lg ring-2 ring-red-400' : 'cursor-grab',
                          APPOINTMENT_COLORS[BLOCK_COLOR].block,
                        )}
                        style={{ top: (top / 60) * HOUR_HEIGHT, height: (length / 60) * HOUR_HEIGHT }}
                      >
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label={`Edit ${format(day, 'EEE, d MMM')}'s blocks`}
                          title={`Edit ${format(day, 'EEE, d MMM')}'s blocks only`}
                          className="absolute right-0.5 top-0.5 rounded p-0.5 hover:bg-black/10"
                          // Not a drag, and not a click on the block.
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); setEditingBlocks(day); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setEditingBlocks(day); }
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </span>
                        <div className="truncate pr-4 font-medium">{b.label}</div>
                        <div className="truncate">{formatTime(top)} – {formatTime(top + length)}</div>
                      </button>
                    );
                  })}

                  {isToday(day) && (
                    <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}>
                      <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                      <div className="h-px bg-red-500" />
                    </div>
                  )}

                  {byDay[i].map(({ apt, start: savedStart, duration, lane, lanes }) => {
                    const key = `apt:${apt.id}`;
                    const start = startOf(key, savedStart);
                    const dragging = drag?.key === key && drag.moved;
                    const canDrag = apt.status !== 'cancelled' && apt.status !== 'no_show';
                    const position = {
                      top: (start / 60) * HOUR_HEIGHT + 1,
                      height: Math.max(duration, 15) / 60 * HOUR_HEIGHT - 2,
                      left: `calc(${(lane / lanes) * 100}% + 2px)`,
                      width: `calc(${100 / lanes}% - 4px)`,
                    };
                    const inactive = apt.status === 'cancelled' || apt.status === 'no_show';
                    return (
                      <button
                        key={apt.id}
                        type="button"
                        onPointerDown={canDrag ? (e) => beginDrag(e, key, savedStart, durationOf(apt)) : undefined}
                        onPointerMove={canDrag ? moveDrag : undefined}
                        onPointerUp={canDrag ? endDrag((newStart) => moveAppointment(apt, newStart)) : undefined}
                        onPointerCancel={() => setDrag(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!justDragged.current) setSelectedId(apt.id);
                        }}
                        className={cn(
                          'absolute z-10 select-none overflow-hidden rounded-sm border-l-4 px-1.5 py-0.5 text-left text-xs leading-tight shadow-sm hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-ring',
                          canDrag && 'touch-none',
                          canDrag && (dragging ? 'z-30 cursor-grabbing shadow-lg ring-2 ring-primary' : 'cursor-grab'),
                          inactive ? INACTIVE_COLOR : APPOINTMENT_COLORS[colorOf(apt)].block,
                        )}
                        style={position}
                        title={`${apt.clients?.name ?? 'Client'} · ${formatTime(start)} – ${formatTime(start + durationOf(apt))}`}
                      >
                        <div className="truncate font-medium">{apt.clients?.name ?? 'Client'}</div>
                        <div className="truncate opacity-80">
                          {formatTime(start)} – {formatTime(start + durationOf(apt))} · {apt.title || (APPOINTMENT_TYPE_LABELS[apt.appointment_type] ?? apt.appointment_type)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="sm:max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.clients?.name ?? 'Client'}</DialogTitle>
              </DialogHeader>
              <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                <dt className="text-muted-foreground">When</dt>
                <dd>
                  {format(parseISO(selected.appointment_date), 'EEE, d MMM yyyy')} ·{' '}
                  {formatTime(minutesOf(selected.appointment_time))} – {formatTime(minutesOf(selected.appointment_time) + durationOf(selected))}
                  <span className="text-muted-foreground"> ({formatDuration(durationOf(selected))})</span>
                </dd>
                {selected.title && (
                  <>
                    <dt className="text-muted-foreground">Title</dt>
                    <dd>{selected.title}</dd>
                  </>
                )}
                <dt className="text-muted-foreground">Type</dt>
                <dd>{APPOINTMENT_TYPE_LABELS[selected.appointment_type] ?? selected.appointment_type}</dd>
                <dt className="text-muted-foreground">Mode</dt>
                <dd>
                  {MEETING_MODE_LABELS[selected.meeting_mode] ?? selected.meeting_mode}
                  {selected.clinic_location && (
                    <span className="text-muted-foreground">
                      {' '}· {clinic.addresses.find((c) => c.key === selected.clinic_location)?.label ?? selected.clinic_location}
                    </span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="capitalize">{selected.outcome ? OUTCOME_LABELS[selected.outcome] : selected.status.replace('_', ' ')}</dd>
                <dt className="text-muted-foreground">Meeting</dt>
                <dd>{renderMeeting(selected)}</dd>
                {selected.notes && (
                  <>
                    <dt className="text-muted-foreground">Notes</dt>
                    <dd className="whitespace-pre-wrap">{selected.notes}</dd>
                  </>
                )}
                {selected.outcome_notes && (
                  <>
                    <dt className="text-muted-foreground">Outcome notes</dt>
                    <dd className="whitespace-pre-wrap">{selected.outcome_notes}</dd>
                  </>
                )}
              </dl>
              <div className="flex flex-wrap gap-2 pt-2">{renderActions(selected)}</div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <RecurringBlocksDialog
        open={editingBlocks !== null}
        onOpenChange={(open) => !open && setEditingBlocks(null)}
        date={editingBlocks instanceof Date ? editingBlocks : null}
      />

      <CreateAppointmentDialog
        open={newSlot !== null}
        onOpenChange={(open) => !open && setNewSlot(null)}
        slot={newSlot}
      />
    </div>
  );
};

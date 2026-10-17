// Swatch row for an appointment's calendar colour. "Auto" (null) follows the
// appointment's type / mode / clinic; any swatch overrides it.
import { Check } from 'lucide-react';
import { APPOINTMENT_COLORS, AppointmentColor, COLOR_KEYS } from '@/lib/appointmentColors';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Props {
  value: AppointmentColor | null;
  autoValue: AppointmentColor;
  onChange: (color: AppointmentColor | null) => void;
}

export const AppointmentColorPicker = ({ value, autoValue, onChange }: Props) => (
  <div className="space-y-2">
    <Label>Calendar Colour</Label>
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          'flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs',
          value === null ? 'border-foreground font-medium' : 'border-border text-muted-foreground hover:border-foreground/50',
        )}
        title={`Automatic — currently ${APPOINTMENT_COLORS[autoValue].label.toLowerCase()}`}
      >
        <span className={cn('h-3 w-3 rounded-full', APPOINTMENT_COLORS[autoValue].swatch)} />
        Auto
      </button>
      {COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full ring-offset-background',
            APPOINTMENT_COLORS[key].swatch,
            value === key ? 'ring-2 ring-foreground ring-offset-2' : 'hover:ring-2 hover:ring-foreground/30 hover:ring-offset-1',
          )}
          title={APPOINTMENT_COLORS[key].label}
          aria-label={APPOINTMENT_COLORS[key].label}
          aria-pressed={value === key}
        >
          {value === key && <Check className="h-3.5 w-3.5 text-white" />}
        </button>
      ))}
    </div>
    <p className="text-xs text-muted-foreground">
      Auto: orange for Mulund East, green for Mulund West, pink for prospect calls, blue for online.
    </p>
  </div>
);

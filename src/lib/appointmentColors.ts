// Calendar colours. Each appointment is coloured automatically by what it is
// (prospect call, online, or which clinic); staff can pick another colour to
// override it. Keys match the appointments_color_check constraint, and the hex
// values are mirrored in api/_lib/zohoClient.js for the Zoho event colour.

export type AppointmentColor =
  | 'orange' | 'green' | 'pink' | 'blue' | 'red'
  | 'purple' | 'teal' | 'yellow' | 'indigo' | 'brown' | 'gray';

interface ColorStyle {
  label: string;
  hex: string;
  // Calendar block: left border, fill and text.
  block: string;
  // Small swatch / dot.
  swatch: string;
}

export const APPOINTMENT_COLORS: Record<AppointmentColor, ColorStyle> = {
  orange: { label: 'Orange', hex: '#F97316', block: 'border-l-orange-500 bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100', swatch: 'bg-orange-500' },
  green: { label: 'Green', hex: '#16A34A', block: 'border-l-green-600 bg-green-100 text-green-900 dark:bg-green-900/40 dark:text-green-100', swatch: 'bg-green-600' },
  pink: { label: 'Pink', hex: '#EC4899', block: 'border-l-pink-500 bg-pink-100 text-pink-900 dark:bg-pink-900/40 dark:text-pink-100', swatch: 'bg-pink-500' },
  blue: { label: 'Blue', hex: '#3B82F6', block: 'border-l-blue-500 bg-blue-100 text-blue-900 dark:bg-blue-900/50 dark:text-blue-100', swatch: 'bg-blue-500' },
  red: { label: 'Red', hex: '#EF4444', block: 'border-l-red-500 bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100', swatch: 'bg-red-500' },
  purple: { label: 'Purple', hex: '#A855F7', block: 'border-l-purple-500 bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100', swatch: 'bg-purple-500' },
  teal: { label: 'Teal', hex: '#14B8A6', block: 'border-l-teal-500 bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-100', swatch: 'bg-teal-500' },
  yellow: { label: 'Yellow', hex: '#EAB308', block: 'border-l-yellow-500 bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100', swatch: 'bg-yellow-500' },
  indigo: { label: 'Indigo', hex: '#6366F1', block: 'border-l-indigo-500 bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100', swatch: 'bg-indigo-500' },
  brown: { label: 'Brown', hex: '#92400E', block: 'border-l-amber-800 bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100', swatch: 'bg-amber-800' },
  gray: { label: 'Gray', hex: '#6B7280', block: 'border-l-gray-500 bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100', swatch: 'bg-gray-500' },
};

export const COLOR_KEYS = Object.keys(APPOINTMENT_COLORS) as AppointmentColor[];

// The recurring daily blocks.
export const BLOCK_COLOR: AppointmentColor = 'red';

// What each automatic colour means, for the calendar legend.
export const COLOR_LEGEND: { color: AppointmentColor; label: string }[] = [
  { color: 'orange', label: 'Mulund East' },
  { color: 'green', label: 'Mulund West' },
  { color: 'pink', label: 'Prospect call' },
  { color: 'blue', label: 'Online' },
  { color: BLOCK_COLOR, label: 'Block' },
];

interface ColorSource {
  appointment_type: string;
  meeting_mode: string;
  clinic_location: string | null;
}

// Prospect calls first, then online, then the clinic the client comes to.
export const autoColor = (apt: ColorSource): AppointmentColor => {
  if (apt.appointment_type === 'prospect_call') return 'pink';
  if (apt.meeting_mode === 'online') return 'blue';
  if (apt.clinic_location === 'mulund_east') return 'orange';
  if (apt.clinic_location === 'mulund_west') return 'green';
  return 'gray';
};

export const colorOf = (apt: ColorSource & { color?: string | null }): AppointmentColor =>
  apt.color && apt.color in APPOINTMENT_COLORS ? (apt.color as AppointmentColor) : autoColor(apt);

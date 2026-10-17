// Ready-to-paste WhatsApp messages sent to clients ahead of an appointment.
// The wording comes from the clinic's own templates; *text* is WhatsApp bold.
import { needsClinicLocation } from './appointmentOutcomes';

export type MessageTemplate = 'mulund_east' | 'mulund_west' | 'counselling_call' | 'followup_call';

export const MESSAGE_TEMPLATE_LABELS: Record<MessageTemplate, string> = {
  mulund_east: 'Mulund East clinic appointment',
  mulund_west: 'Mulund West clinic appointment',
  counselling_call: 'Counselling call (40 min)',
  followup_call: 'Follow-up call (20 min)',
};

const PHONE = '7045338184';

const CLINIC_DETAILS: Record<'mulund_east' | 'mulund_west', { name: string; addressIntro: string; address: string; mapUrl: string }> = {
  mulund_east: {
    name: 'Mulund East clinic',
    addressIntro: 'Also please find the *new Mulund East clinic address* below:',
    address: [
      'Dietitian Saloni Bhatt Koradia - Bounce The Pound',
      'Office No. 107, 1st Floor, HS PEARL commercial (Shilpa), Sane Guruji Nagar, Opp ICICI Bank, Mulund East, Mumbai 400081',
    ].join('\n'),
    mapUrl: 'https://maps.app.goo.gl/Vj9TmQ18QKEaMxip7?g_st=aw',
  },
  mulund_west: {
    name: 'Mulund West clinic',
    addressIntro: "Also please find the *Mulund West clinic's address and location* below:",
    address: [
      'Bounce The Pound with Dietitian Saloni',
      "C/o. Dr. Surendra Shetty's Dental clinic",
      'B/5, Surya Prakash bldg, MG Rd,',
      'Above Bank of Baroda (Dena bank), Mulund West.',
      'Mumbai 400080.',
    ].join('\n'),
    mapUrl: 'https://maps.app.goo.gl/FadjNRSZLhbLo8hA9',
  },
};

export interface MessageAppointment {
  appointment_date: string; // YYYY-MM-DD
  appointment_time: string; // HH:MM[:SS]
  appointment_type: string;
  meeting_mode: string;
  clinic_location: string | null;
  meet_link: string | null;
  clients?: { name: string; address_as?: string | null } | null;
}

// In-person appointments use their clinic's template; online ones use the
// counselling call for a First Counselling and the follow-up call otherwise.
export const defaultTemplateFor = (apt: MessageAppointment): MessageTemplate => {
  if (needsClinicLocation(apt.meeting_mode)) {
    return apt.clinic_location === 'mulund_west' ? 'mulund_west' : 'mulund_east';
  }
  return apt.appointment_type === 'consultation' ? 'counselling_call' : 'followup_call';
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ordinal = (n: number) => {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

// "today" / "tomorrow" / "Friday", relative to the day the message is copied.
const relativeDay = (date: Date, now: Date) => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return WEEKDAYS[date.getDay()];
};

// "17:00:00" -> "5pm", "13:30" -> "1:30pm"
const formatTime = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return `${hour12}${m ? `:${String(m).padStart(2, '0')}` : ''}${suffix}`;
};

// Messages go out the day before the appointment, i.e. when it is tomorrow.
export const isMessageSendDay = (appointmentDate: string, now = new Date()): boolean => {
  const [y, mo, d] = appointmentDate.split('-').map(Number);
  return relativeDay(new Date(y, mo - 1, d), now) === 'tomorrow';
};

export const buildAppointmentMessage = (apt: MessageAppointment, template: MessageTemplate, now = new Date()): string => {
  const [y, mo, d] = apt.appointment_date.split('-').map(Number);
  const date = new Date(y, mo - 1, d);
  const day = relativeDay(date, now);
  const dateText = `${ordinal(d)} ${MONTHS[mo - 1]}`;
  const timeText = formatTime(apt.appointment_time);
  // "How to Address" when set, otherwise the client's first name.
  const greetName = apt.clients?.address_as?.trim() || apt.clients?.name?.trim().split(/\s+/)[0] || '';
  const greeting = greetName ? `Heyyy ${greetName}` : 'Heyyy';
  const signOff = `Eat more. Eat healthy.\n📞 ${PHONE}`;

  if (template === 'mulund_east' || template === 'mulund_west') {
    const clinic = CLINIC_DETAILS[template];
    return [
      greeting,
      `Your appointment is scheduled for ${day} i.e. ${dateText} at ${timeText} at the *${clinic.name}*`,
      'If there is any change, please let me know in advance; as we are accommodating clients only on an appointment basis. Thank You. 😊',
      signOff,
      clinic.addressIntro,
      clinic.address,
      clinic.mapUrl,
    ].join('\n\n');
  }

  const isCounselling = template === 'counselling_call';
  return [
    greeting,
    `Our ${isCounselling ? 'counseling' : 'follow-up'} call is scheduled for ${day}, *${dateText}, around ${timeText}*. I shall need ${isCounselling ? 40 : 20} minutes of your time for the same.`,
    ...(apt.meet_link ? [`Join here: ${apt.meet_link}`] : []),
    'Just a small heads-up, there may occasionally be a delay of a few minutes due to unforeseen circumstances, like the previous session running a little late, an unexpected change in the schedule, etc. Thank you so much for your patience and understanding ❤️',
    'If there’s any change from your end, do let us know in advance. And in case you don’t hear from us, feel free to give me a call.',
    'Thank you 😊',
    signOff,
  ].join('\n\n');
};

// wa.me needs the number in international format, digits only.
// Client phones are stored in mixed formats ("98765 43210", "+91-98765-43210",
// "098765 43210"); bare 10-digit numbers are assumed to be Indian.
export const toWhatsAppNumber = (phone: string | null | undefined): string | null => {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
};

// Opens a chat with the number if one is given, otherwise lets the user pick a contact.
export const whatsAppShareUrl = (message: string, phone?: string | null) => {
  const number = toWhatsAppNumber(phone);
  return `https://wa.me/${number ?? ''}?text=${encodeURIComponent(message)}`;
};

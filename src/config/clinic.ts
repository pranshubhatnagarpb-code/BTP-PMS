// Clinic / brand configuration for the white-label PMS.
// Update this single file to rebrand the entire application.

export const clinic = {
  name: 'From Monday',
  doctorName: 'Dr. Aamit Shah',
  tagline: 'Decoding Nutrition',
  doctorTagline: 'Health & Lifestyle Coach',
  fullTitle: 'From Monday | Dr. Aamit Shah',
  shortTitle: 'From Monday',
  address:
    '3rd floor, 314, Panchshil Plaza, N S Patkar Marg, Gamdevi, Mumbai, Maharashtra 400007',
  phone: '098708 41111',
  email: '',
  copyrightYear: new Date().getFullYear(),
  copyrightText: `© ${new Date().getFullYear()} From Monday — Dr. Aamit Shah. All rights reserved.`,
  logoPath: '/clinic-logo.png',
} as const;

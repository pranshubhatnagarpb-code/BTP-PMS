// Clinic / brand configuration for the white-label PMS.
// Update this single file to rebrand the entire application.

export const clinic = {
  name: 'Bounce The Pound',
  doctorName: '',
  tagline: 'Sustainable Weight Loss',
  doctorTagline: '',
  fullTitle: 'Bounce The Pound',
  shortTitle: 'Bounce The Pound',
  addresses: [
    { key: 'mulund_east', label: 'Mulund East Clinic', address: 'Office No. 107, 1st Floor, HS Pearl (Shilpa), opposite ICICI Bank, above HS Group, Sane Guruji Nagar, Mumbai, Maharashtra 400081' },
    { key: 'mulund_west', label: 'Mulund West Clinic', address: 'B/5, Surya Prakash Bldg, Above Dena Bank, M.G. Rd, Mulund West, Mumbai-400080' },
  ],
  phone: '(+91) 7045338184',
  email: '[NEW_CLINIC_EMAIL]',
  copyrightYear: new Date().getFullYear(),
  copyrightText: `© ${new Date().getFullYear()} Bounce The Pound. All rights reserved.`,
  logoPath: '/logo.png',
} as const;

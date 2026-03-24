// Mock data for the dashboard

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  startDate: string;
  receivable: number;
  status: 'active' | 'inactive';
}

export interface Appointment {
  id: string;
  clientName: string;
  dietitianName: string;
  date: string;
  time: string;
  type: string;
}

export interface Birthday {
  id: string;
  clientName: string;
  date: string;
  type: 'birthday' | 'anniversary';
}

export interface LeadFollowup {
  id: string;
  clientName: string;
  phone: string;
  lastContact: string;
  status: string;
}

export interface ServiceReceivable {
  id: string;
  clientName: string;
  dietitianName: string;
  serviceName: string;
  amount: number;
  dueDate: string;
}

export interface BalanceReceivable {
  id: string;
  clientName: string;
  startDate: string;
  mobileNumber: string;
  amount: number;
}

export interface DietChartReminder {
  id: string;
  clientName: string;
  dietitianName: string;
  date: string;
}

// Dashboard stats
export const dashboardStats = {
  totalActiveClients: 5,
  clientsChange: '-58.33%',
  serviceSalesThisMonth: 8,
  serviceSalesChange: '-52.94%',
  productSalesThisMonth: 3,
  productSalesChange: '-95.38%',
  balanceActive: 134500.01,
  balanceInactive: 137218.81,
};

// Mock clients
export const clients: Client[] = [
  { id: '1', name: 'Seema Sharma', phone: '9414372953', email: 'seema@email.com', startDate: '21/07/2025', receivable: 5000, status: 'active' },
  { id: '2', name: 'Shabana', phone: '9929878604', email: 'shabana@email.com', startDate: '01/08/2025', receivable: 3500, status: 'active' },
  { id: '3', name: 'Nutrition hai zaruri', phone: '9876543102', email: 'nutrition@email.com', startDate: '11/03/2025', receivable: 7200, status: 'active' },
  { id: '4', name: 'Varsha Goyal', phone: '9812345678', email: 'varsha@email.com', startDate: '15/04/2025', receivable: 4500, status: 'active' },
  { id: '5', name: 'Mamta Jain', phone: '9823456789', email: 'mamta@email.com', startDate: '20/05/2025', receivable: 6000, status: 'inactive' },
];

// Today's appointments
export const todaysAppointments: Appointment[] = [];

// Today's birthdays
export const todaysBirthdays: Birthday[] = [];

// Today's lead followups
export const todaysLeadFollowups: LeadFollowup[] = [];

// Service receivables
export const serviceReceivables: ServiceReceivable[] = [
  { id: '1', clientName: 'Seema Sharma', dietitianName: 'Dietician Kapila gupta', serviceName: 'Disease management', amount: 5000, dueDate: '25/01/2026' },
  { id: '2', clientName: 'Varsha Goyal', dietitianName: 'N/A', serviceName: 'Functional Diet', amount: 4500, dueDate: '28/01/2026' },
  { id: '3', clientName: 'Mamta Jain', dietitianName: 'N/A', serviceName: 'Weight management', amount: 6000, dueDate: '30/01/2026' },
];

// Balance receivables
export const balanceReceivables: BalanceReceivable[] = [
  { id: '1', clientName: 'Shabana', startDate: '01/08/2025', mobileNumber: '9929878604', amount: 3500 },
  { id: '2', clientName: 'Nutrition hai zaruri', startDate: '11/03/2025', mobileNumber: '9876543102', amount: 7200 },
  { id: '3', clientName: 'Seema Sharma', startDate: '21/07/2025', mobileNumber: '9414372953', amount: 5000 },
];

// Diet chart reminders
export const dietChartReminders: DietChartReminder[] = [
  { id: '1', clientName: 'Stuti', dietitianName: 'Dietician Kapila gupta', date: '16/01/2026' },
  { id: '2', clientName: 'Stuti', dietitianName: 'Dietician Kapila gupta', date: '17/01/2026' },
  { id: '3', clientName: 'Swati pandya', dietitianName: 'Dietician Kapila gupta', date: '16/01/2026' },
];

// Diet options for creating diet plans
export interface DietOption {
  id: string;
  name: string;
  calories: number;
  category: 'breakfast' | 'lunch' | 'snacks' | 'dinner';
  type: 'veg' | 'non-veg';
}

export const dietOptions: DietOption[] = [
  // Breakfast options
  { id: 'b1', name: 'Poha with vegetables', calories: 250, category: 'breakfast', type: 'veg' },
  { id: 'b2', name: 'Upma with chutney', calories: 220, category: 'breakfast', type: 'veg' },
  { id: 'b3', name: 'Idli sambar (3 pieces)', calories: 280, category: 'breakfast', type: 'veg' },
  { id: 'b4', name: 'Dosa with coconut chutney', calories: 300, category: 'breakfast', type: 'veg' },
  { id: 'b5', name: 'Paratha with curd', calories: 350, category: 'breakfast', type: 'veg' },
  { id: 'b6', name: 'Oats porridge with fruits', calories: 200, category: 'breakfast', type: 'veg' },
  { id: 'b7', name: 'Egg bhurji with toast', calories: 320, category: 'breakfast', type: 'non-veg' },
  { id: 'b8', name: 'Boiled eggs (2) with bread', calories: 280, category: 'breakfast', type: 'non-veg' },
  
  // Lunch options
  { id: 'l1', name: 'Dal rice with sabzi', calories: 450, category: 'lunch', type: 'veg' },
  { id: 'l2', name: 'Roti (2) with paneer curry', calories: 480, category: 'lunch', type: 'veg' },
  { id: 'l3', name: 'Vegetable biryani', calories: 420, category: 'lunch', type: 'veg' },
  { id: 'l4', name: 'Rajma chawal', calories: 440, category: 'lunch', type: 'veg' },
  { id: 'l5', name: 'Chole with bhature', calories: 550, category: 'lunch', type: 'veg' },
  { id: 'l6', name: 'Chicken curry with rice', calories: 520, category: 'lunch', type: 'non-veg' },
  { id: 'l7', name: 'Fish curry with roti', calories: 480, category: 'lunch', type: 'non-veg' },
  
  // Snacks options
  { id: 's1', name: 'Fruit salad', calories: 120, category: 'snacks', type: 'veg' },
  { id: 's2', name: 'Sprouts chaat', calories: 150, category: 'snacks', type: 'veg' },
  { id: 's3', name: 'Roasted makhana', calories: 100, category: 'snacks', type: 'veg' },
  { id: 's4', name: 'Nuts and dry fruits', calories: 180, category: 'snacks', type: 'veg' },
  { id: 's5', name: 'Dhokla (2 pieces)', calories: 140, category: 'snacks', type: 'veg' },
  { id: 's6', name: 'Green tea with biscuits', calories: 80, category: 'snacks', type: 'veg' },
  
  // Dinner options
  { id: 'd1', name: 'Vegetable soup with bread', calories: 200, category: 'dinner', type: 'veg' },
  { id: 'd2', name: 'Khichdi with papad', calories: 320, category: 'dinner', type: 'veg' },
  { id: 'd3', name: 'Roti (2) with dal', calories: 380, category: 'dinner', type: 'veg' },
  { id: 'd4', name: 'Palak paneer with roti', calories: 420, category: 'dinner', type: 'veg' },
  { id: 'd5', name: 'Mixed vegetable curry with rice', calories: 400, category: 'dinner', type: 'veg' },
  { id: 'd6', name: 'Grilled chicken salad', calories: 350, category: 'dinner', type: 'non-veg' },
  { id: 'd7', name: 'Egg curry with chapati', calories: 380, category: 'dinner', type: 'non-veg' },
];

// Helper function to get options by category
export const getDietOptionsByCategory = (category: DietOption['category']) => 
  dietOptions.filter(opt => opt.category === category);

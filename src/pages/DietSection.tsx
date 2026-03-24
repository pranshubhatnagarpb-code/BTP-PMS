import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Home, ChevronRight, Download, Mail, Plus, Trash2, ClipboardList, FilePlus } from 'lucide-react';
import { useDietOptions, DietOption } from '@/hooks/useDietOptions';
import { useActiveClients } from '@/hooks/useClients';
import { useCreateDietPlan } from '@/hooks/useDietPlans';
import { toast } from 'sonner';
import { AIDietPlanGenerator } from '@/components/diet/AIDietPlanGenerator';
import SavedDietPlans from '@/components/diet/SavedDietPlans';

interface DayPlan {
  id: string;
  day: string;
  week: string;
  breakfast: string;
  lunch: string;
  snacks: string;
  dinner: string;
  instructions: string;
}

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

const DietSection = () => {
  const [selectedClient, setSelectedClient] = useState('');
  const [planName, setPlanName] = useState('');
  const [generalInstructions, setGeneralInstructions] = useState('');
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([
    {
      id: '1',
      day: 'Monday',
      week: 'Week 1',
      breakfast: '',
      lunch: '',
      snacks: '',
      dinner: '',
      instructions: '',
    },
  ]);

  const { data: dietOptions = [], isLoading: optionsLoading } = useDietOptions();
  const { data: clients = [], isLoading: clientsLoading } = useActiveClients();
  const createDietPlan = useCreateDietPlan();

  const breakfastOptions = dietOptions.filter(opt => opt.meal_type === 'breakfast');
  const lunchOptions = dietOptions.filter(opt => opt.meal_type === 'lunch');
  const snacksOptions = dietOptions.filter(opt => opt.meal_type === 'snacks');
  const dinnerOptions = dietOptions.filter(opt => opt.meal_type === 'dinner');

  const addDayPlan = () => {
    const newPlan: DayPlan = {
      id: Date.now().toString(),
      day: 'Monday',
      week: 'Week 1',
      breakfast: '',
      lunch: '',
      snacks: '',
      dinner: '',
      instructions: '',
    };
    setDayPlans([...dayPlans, newPlan]);
  };

  const removeDayPlan = (id: string) => {
    if (dayPlans.length > 1) {
      setDayPlans(dayPlans.filter((plan) => plan.id !== id));
    }
  };

  const updateDayPlan = (id: string, field: keyof DayPlan, value: string) => {
    setDayPlans(
      dayPlans.map((plan) =>
        plan.id === id ? { ...plan, [field]: value } : plan
      )
    );
  };

  const calculateTotalCalories = (plan: DayPlan): number => {
    let total = 0;
    
    [plan.breakfast, plan.lunch, plan.snacks, plan.dinner].forEach((mealId) => {
      const meal = dietOptions.find((opt) => opt.id === mealId);
      if (meal) total += meal.calories;
    });
    
    return total;
  };

  const getMealName = (mealId: string, options: DietOption[]): string => {
    return options.find((opt) => opt.id === mealId)?.name || '-';
  };

  const getMealCalories = (mealId: string): number => {
    return dietOptions.find((opt) => opt.id === mealId)?.calories || 0;
  };

  const savePlan = async () => {
    if (!selectedClient || !planName) {
      toast.error('Please select client and enter plan name');
      return;
    }

    const days = dayPlans.map((plan, index) => ({
      day_label: `${plan.day} - ${plan.week}`,
      breakfast_option_id: plan.breakfast || null,
      lunch_option_id: plan.lunch || null,
      snacks_option_id: plan.snacks || null,
      dinner_option_id: plan.dinner || null,
      total_calories: calculateTotalCalories(plan),
      notes: plan.instructions,
      sort_order: index,
    }));

    await createDietPlan.mutateAsync({
      client_id: selectedClient,
      plan_name: planName,
      instructions: generalInstructions,
      days,
    });

    // Reset form
    setPlanName('');
    setGeneralInstructions('');
    setDayPlans([{
      id: '1',
      day: 'Monday',
      week: 'Week 1',
      breakfast: '',
      lunch: '',
      snacks: '',
      dinner: '',
      instructions: '',
    }]);
  };

  const generatePDF = () => {
    if (!selectedClient || !planName || dayPlans.some(p => !p.breakfast || !p.lunch || !p.snacks || !p.dinner)) {
      toast.error('Please fill all required fields');
      return;
    }

    const clientName = clients.find(c => c.id === selectedClient)?.name || '';
    
    let content = `
      <html>
        <head>
          <title>Diet Plan - ${clientName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #EC4899; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #FDF2F8; color: #BE185D; }
            .header { margin-bottom: 20px; }
            .instructions { font-style: italic; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>NUTRITION HAI ZARURI</h1>
            <h2>Diet Plan: ${planName}</h2>
            <p><strong>Client:</strong> ${clientName}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
            ${generalInstructions ? `<p><strong>Instructions:</strong> ${generalInstructions}</p>` : ''}
          </div>
          <table>
            <thead>
              <tr>
                <th>Day/Week</th>
                <th>Breakfast</th>
                <th>Lunch</th>
                <th>Snacks</th>
                <th>Dinner</th>
                <th>Calories</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${dayPlans.map(plan => `
                <tr>
                  <td>${plan.day} - ${plan.week}</td>
                  <td>${getMealName(plan.breakfast, breakfastOptions)} (${getMealCalories(plan.breakfast)} kcal)</td>
                  <td>${getMealName(plan.lunch, lunchOptions)} (${getMealCalories(plan.lunch)} kcal)</td>
                  <td>${getMealName(plan.snacks, snacksOptions)} (${getMealCalories(plan.snacks)} kcal)</td>
                  <td>${getMealName(plan.dinner, dinnerOptions)} (${getMealCalories(plan.dinner)} kcal)</td>
                  <td><strong>${calculateTotalCalories(plan)} kcal</strong></td>
                  <td class="instructions">${plan.instructions || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p style="margin-top: 30px; color: #666;">
            © 2026 Nutrition Hai Zaruri. This diet plan is personalized and should be followed as advised.
          </p>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
    }

    toast.success('PDF generated successfully!');
  };

  const sendEmail = () => {
    if (!selectedClient || !planName) {
      toast.error('Please select client and enter plan name');
      return;
    }

    const client = clients.find(c => c.id === selectedClient);
    const clientEmail = client?.email || '';
    const subject = encodeURIComponent(`Diet Plan: ${planName} - Nutrition Hai Zaruri`);
    const body = encodeURIComponent(`Dear ${client?.name || 'Client'},\n\nPlease find attached your personalized diet plan: ${planName}\n\nBest regards,\nNutrition Hai Zaruri Team`);
    
    window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`);
    toast.success('Email client opened!');
  };

  if (optionsLoading || clientsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Diet Section</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Diet Section</h1>
      </div>

      <Tabs defaultValue="create" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <FilePlus className="h-4 w-4" /> Create Plan
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Saved Plans
          </TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <div className="flex justify-end gap-2 mb-6">
            <Button variant="outline" onClick={generatePDF}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={sendEmail}>
              <Mail className="h-4 w-4 mr-2" />
              Email PDF
            </Button>
            <Button onClick={savePlan} disabled={createDietPlan.isPending} className="gradient-primary text-primary-foreground">
              {createDietPlan.isPending ? 'Saving...' : 'Save Plan'}
            </Button>
          </div>

          {/* AI Diet Plan Generator */}
          <AIDietPlanGenerator clients={clients} />

          {/* Client & Plan Info */}
          <Card className="p-6 mb-6 shadow-card">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="client">Select Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a client" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {clients.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground">No clients yet. Add clients in Clients section first.</div>
                    ) : (
                      clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="planName">Plan Name</Label>
                <Input
                  id="planName"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="e.g., Weight Loss Plan - January"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instructions">General Instructions</Label>
                <Input
                  id="instructions"
                  value={generalInstructions}
                  onChange={(e) => setGeneralInstructions(e.target.value)}
                  placeholder="e.g., Drink 8 glasses of water daily"
                />
              </div>
            </div>
          </Card>

          {/* Day Plans */}
          <div className="space-y-4">
            {dayPlans.map((plan, index) => (
              <Card key={plan.id} className="p-6 shadow-card animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Day {index + 1}</h3>
                  {dayPlans.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDayPlan(plan.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label>Day</Label>
                    <Select value={plan.day} onValueChange={(val) => updateDayPlan(plan.id, 'day', val)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {days.map((day) => (
                          <SelectItem key={day} value={day}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Week</Label>
                    <Select value={plan.week} onValueChange={(val) => updateDayPlan(plan.id, 'week', val)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {weeks.map((week) => (
                          <SelectItem key={week} value={week}>{week}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label>Breakfast</Label>
                    <Select value={plan.breakfast} onValueChange={(val) => updateDayPlan(plan.id, 'breakfast', val)}>
                      <SelectTrigger><SelectValue placeholder="Select breakfast" /></SelectTrigger>
                      <SelectContent>
                        {breakfastOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.name} ({opt.calories} kcal) {!opt.is_vegetarian && '🍗'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Lunch</Label>
                    <Select value={plan.lunch} onValueChange={(val) => updateDayPlan(plan.id, 'lunch', val)}>
                      <SelectTrigger><SelectValue placeholder="Select lunch" /></SelectTrigger>
                      <SelectContent>
                        {lunchOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.name} ({opt.calories} kcal) {!opt.is_vegetarian && '🍗'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Snacks</Label>
                    <Select value={plan.snacks} onValueChange={(val) => updateDayPlan(plan.id, 'snacks', val)}>
                      <SelectTrigger><SelectValue placeholder="Select snacks" /></SelectTrigger>
                      <SelectContent>
                        {snacksOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.name} ({opt.calories} kcal)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Dinner</Label>
                    <Select value={plan.dinner} onValueChange={(val) => updateDayPlan(plan.id, 'dinner', val)}>
                      <SelectTrigger><SelectValue placeholder="Select dinner" /></SelectTrigger>
                      <SelectContent>
                        {dinnerOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.name} ({opt.calories} kcal) {!opt.is_vegetarian && '🍗'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-2 flex-1 mr-4">
                    <Label>Instructions</Label>
                    <Textarea
                      value={plan.instructions}
                      onChange={(e) => updateDayPlan(plan.id, 'instructions', e.target.value)}
                      placeholder="Add any special instructions for this day..."
                      rows={2}
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Total Calories</p>
                    <p className="text-2xl font-bold text-primary">
                      {calculateTotalCalories(plan)} kcal
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Button onClick={addDayPlan} className="mt-4 gradient-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" />
            Add Another Day
          </Button>
        </TabsContent>

        <TabsContent value="saved">
          <SavedDietPlans />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default DietSection;

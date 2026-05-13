import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Trash2, Download, Search, Calendar, User, Copy, Loader2, Edit, Check, X } from 'lucide-react';
import { useSavedDietPlans, useDeleteDietPlan } from '@/hooks/useDietPlans';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Import the AIDietPlanGenerator component
import { AIDietPlanGenerator } from './AIDietPlanGenerator';

const SavedDietPlans = () => {
  const { data: plans = [], isLoading, refetch } = useSavedDietPlans();
  const deletePlan = useDeleteDietPlan();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isReusing, setIsReusing] = useState<string | null>(null);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [editPlanData, setEditPlanData] = useState<{ id: string; data: any; source: 'draft' | 'reuse'; clientId?: string } | null>(null);

  
  // Calculate week number based on client's diet chart count
  const getWeekNumber = (clientId: string, planId: string, plan: any) => {
    console.log('🔍 DEBUG getWeekNumber called for plan:', {
      planId,
      clientId,
      is_ai_generated: plan.is_ai_generated,
      has_ai_plan_data: !!plan.ai_plan_data,
      editableWeekNumber: plan.ai_plan_data?.editableWeekNumber,
      ai_plan_data: plan.ai_plan_data
    });
    
    // First check if there's an edited week number in ai_plan_data
    if (plan.is_ai_generated && plan.ai_plan_data && plan.ai_plan_data.editableWeekNumber) {
      const weekNum = parseInt(plan.ai_plan_data.editableWeekNumber);
      console.log('🔍 DEBUG: Using editableWeekNumber:', weekNum);
      return weekNum;
    }
    
    console.log('🔍 DEBUG: No editableWeekNumber found, calculating fallback');
    
    // Fall back to calculated week number based on plan position
    const clientPlans = plans.filter(p => p.client_id === clientId);
    // Sort by created_at ascending to get chronological order
    const sortedClientPlans = [...clientPlans].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const planIndex = sortedClientPlans.findIndex(p => p.id === planId);
    const fallbackWeek = planIndex + 1; // Week numbers start from 1
    console.log('🔍 DEBUG: Using fallback week number:', fallbackWeek);
    return fallbackWeek;
  };

  // Get start date from AI plan data, database, or fall back to created_at
  const getStartDate = (plan: any) => {
    // First check if there's an edited start date in ai_plan_data
    if (plan.is_ai_generated && plan.ai_plan_data && plan.ai_plan_data.editableStartDate) {
      return new Date(plan.ai_plan_data.editableStartDate);
    }
    // Then check AI plan data startDate
    if (plan.is_ai_generated && plan.ai_plan_data && plan.ai_plan_data.startDate) {
      return new Date(plan.ai_plan_data.startDate);
    }
    // Then check if there's a start_date field in the database
    if (plan.start_date) {
      return new Date(plan.start_date);
    }
    // Fall back to created_at
    return new Date(plan.created_at);
  };

  // Get actual number of days from plan data
  const getDayCount = (plan: any) => {
    // First check if there's an edited day count in ai_plan_data
    if (plan.is_ai_generated && plan.ai_plan_data && plan.ai_plan_data.editableDayCount) {
      return parseInt(plan.ai_plan_data.editableDayCount);
    }
    
    // Then check diet_plan_days
    if (plan.diet_plan_days && plan.diet_plan_days.length > 0) {
      return plan.diet_plan_days.length;
    }
    
    // Then check AI plan data dayGroups
    if (plan.is_ai_generated && plan.ai_plan_data && plan.ai_plan_data.dayGroups) {
      // Count actual days from dayGroups labels
      // Labels like "Monday & Thursday" contain 2 days, "Wednesday" contains 1 day, etc.
      let totalDays = 0;
      
      plan.ai_plan_data.dayGroups.forEach((group: any) => {
        if (group.label) {
          // Count days in the label (split by " & ", " & ", ", ")
          const daysInLabel = group.label.split(/ & |, | &/).length;
          totalDays += daysInLabel;
        } else {
          totalDays += 1; // Default to 1 if no label
        }
      });
      
      return totalDays;
    }
    
    return 0;
  };

  // Get clients for AI generator
  const [clients, setClients] = useState<any[]>([]);
  
  React.useEffect(() => {
    const fetchClients = async () => {
      const { data } = await supabase.from('clients').select('*');
      setClients(data || []);
    };
    fetchClients();
  }, []);

  const handleEditPlan = (plan: any) => {
    if (!plan.is_ai_generated || !plan.ai_plan_data) {
      toast.error('Only AI-generated plans can be edited');
      return;
    }
    setEditPlanData({
      id: plan.id,
      data: {
        ...plan.ai_plan_data,
        clientId: plan.client_id, // Add client ID to the plan data
      },
      source: plan.status === 'draft' ? 'draft' : 'reuse',
      clientId: plan.client_id, // Add client ID at the top level
    });
    setShowAIGenerator(true);
  };

  const handleReusePlan = (plan: any) => {
    if (!plan.is_ai_generated || !plan.ai_plan_data) {
      toast.error('Only AI-generated plans can be reused');
      return;
    }
    setEditPlanData({
      id: plan.id,
      data: {
        ...plan.ai_plan_data,
        clientId: plan.client_id, // Add client ID to the plan data
      },
      source: 'reuse',
      clientId: plan.client_id, // Add client ID at the top level
    });
    setShowAIGenerator(true);
  };

  const filtered = plans.filter((plan: any) => {
    const matchesSearch =
      plan.plan_name?.toLowerCase().includes(search.toLowerCase()) ||
      plan.clients?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'completed' && plan.status === 'approved') ||
      (statusFilter === 'draft' && plan.status === 'draft');
    return matchesSearch && matchesStatus;
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this diet plan?')) {
      deletePlan.mutate(id);
    }
  };

  const handleDownloadPDF = (plan: any) => {
    const isAI = plan.is_ai_generated && plan.ai_plan_data;

    if (!isAI) {
      toast.error('Only AI-generated plans can be downloaded');
      return;
    }

    // Open the AI generator with the plan data for consistent PDF generation
    setEditPlanData({
      id: plan.id,
      data: plan.ai_plan_data,
      source: 'reuse',
      clientId: plan.client_id
    });
    setShowAIGenerator(true);
    toast.success('Opening diet plan generator for PDF download...');
  };

  // Utility function to calculate age
  const calculateAge = (dateOfBirth: string) => {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4 shadow-card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by plan name or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Results Count */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Diet Plans</h2>
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filtered.length}</span> 
            {filtered.length === 1 ? ' diet plan' : ' diet plans'}
            {statusFilter !== 'all' && ` with ${statusFilter} status`}
            {search && ` matching "${search}"`}
          </p>
        </div>
      </div>

      {/* Plans List */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center shadow-card">
          <p className="text-muted-foreground">No saved diet plans found.</p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filtered.map((plan: any) => (
            <Card key={plan.id} className="p-5 shadow-card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-foreground text-lg">{plan.plan_name}</h3>
                    <Badge variant={plan.status === 'approved' ? 'default' : 'secondary'}>
                      {plan.status === 'approved' ? 'Completed' : plan.status}
                    </Badge>
                    {plan.is_ai_generated && (
                      <Badge variant="outline" className="border-primary text-primary">AI Generated</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {plan.clients?.name || 'Unknown'}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Start: {format(getStartDate(plan), 'dd MMM yyyy')}</span>
                    <span>{getDayCount(plan)} days</span>
                    <span>Week {getWeekNumber(plan.client_id, plan.id, plan)}</span>
                    <span className="flex items-center gap-1 text-xs">Created: {format(new Date(plan.created_at), 'dd MMM yyyy')}</span>
                  </div>
                  {plan.instructions && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{plan.instructions}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedPlan(plan)}>
                    <Eye className="h-4 w-4 mr-1" /> View
                  </Button>
                  {plan.is_ai_generated && plan.ai_plan_data && (
                    <>
                      {plan.status === 'draft' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditPlan(plan)}
                          title="Edit this draft"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReusePlan(plan)}
                        title="Edit and reuse this plan"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Edit & Reuse
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleDownloadPDF(plan)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(plan.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* View Plan Dialog */}
      <Dialog open={!!selectedPlan} onOpenChange={() => setSelectedPlan(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPlan?.plan_name}</DialogTitle>
          </DialogHeader>
          {selectedPlan && <PlanDetailView plan={selectedPlan} />}
        </DialogContent>
      </Dialog>

      {/* AI Diet Plan Generator Dialog */}
      <Dialog open={showAIGenerator} onOpenChange={(open) => {
        setShowAIGenerator(open);
        if (!open) {
          setEditPlanData(null);
        }
      }}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editPlanData?.source === 'draft' ? 'Edit Draft' : 
               editPlanData?.source === 'reuse' ? 'Reuse & Edit Plan' : 
               'AI Diet Plan Generator'}
            </DialogTitle>
          </DialogHeader>
          {editPlanData && (
            <AIDietPlanGenerator 
              clients={clients}
              editModeData={editPlanData}
              onClose={() => {
                setShowAIGenerator(false);
                setEditPlanData(null);
                refetch(); // Refresh the plans list after editing
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

const PlanDetailView = ({ plan }: { plan: any }) => {
  const isAI = plan.is_ai_generated && plan.ai_plan_data;
  const [editingServingSize, setEditingServingSize] = useState(false);
  const [servingSizeValue, setServingSizeValue] = useState('');

  const handleEditServingSize = () => {
    const aiData = plan.ai_plan_data as any;
    setServingSizeValue(aiData?.servingSize || '1 bowl is 250ml, 1 cup 150ml, 1 katori 100ml');
    setEditingServingSize(true);
  };

  const handleSaveServingSize = async () => {
    try {
      const aiData = plan.ai_plan_data as any;
      const updatedAiData = { ...aiData, servingSize: servingSizeValue };
      
      const { error } = await supabase
        .from('diet_plans')
        .update({ ai_plan_data: updatedAiData })
        .eq('id', plan.id);

      if (error) throw error;

      // Update local plan data
      plan.ai_plan_data = updatedAiData;
      
      toast.success('Serving size updated successfully!');
      setEditingServingSize(false);
    } catch (error: any) {
      console.error('Error updating serving size:', error);
      toast.error('Failed to update serving size');
    }
  };

  if (isAI) {
    const aiData = plan.ai_plan_data as any;
    const dayGroups = aiData?.dayGroups || [];
    const affirmations = aiData?.affirmations || [];
    const importantNotes = aiData?.importantNotes || [];

    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Badge>{plan.status}</Badge>
          <Badge variant="outline" className="border-primary text-primary">AI Generated</Badge>
        </div>
        <p className="text-sm text-muted-foreground"><strong>Client:</strong> {plan.clients?.name}</p>
        {plan.instructions && <p className="text-sm"><strong>Instructions:</strong> {plan.instructions}</p>}

        {affirmations.length > 0 && (
          <div className="p-3 rounded-lg bg-accent/50">
            <h4 className="font-semibold mb-1 text-sm">Affirmations</h4>
            <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-0.5">
              {affirmations.map((a: string, i: number) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}

        {dayGroups.map((group: any, gi: number) => (
          <div key={gi}>
            <h4 className="font-semibold text-primary mb-2">{group.label}</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Food Plan</TableHead>
                  <TableHead>Alternative</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(group.meals || []).map((meal: any, mi: number) => (
                  <TableRow key={mi}>
                    <TableCell className="font-medium">{meal.period || '-'}</TableCell>
                    <TableCell>{meal.time || '-'}</TableCell>
                    <TableCell>{meal.foodPlan || '-'}</TableCell>
                    <TableCell>{meal.alternative || '-'}</TableCell>
                    <TableCell>{meal.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}

        {aiData?.servingSize && (
          <div className="text-sm">
            {editingServingSize ? (
              <div className="flex items-start gap-2">
                <Textarea 
                  value={servingSizeValue} 
                  onChange={e => setServingSizeValue(e.target.value)} 
                  className="flex-1 min-h-[60px]"
                  placeholder="Enter serving size guidelines..."
                />
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" onClick={handleSaveServingSize}>
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingServingSize(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between group">
                <p><strong>Serving Size:</strong> {aiData.servingSize}</p>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleEditServingSize}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )}

        {importantNotes.length > 0 && (
          <div>
            <h4 className="font-semibold mb-1">Important Notes</h4>
            <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-0.5">
              {importantNotes.map((n: string, i: number) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        )}

        {aiData?.skinCareTips && (
          <div><h4 className="font-semibold mb-1">Skin Care Tips</h4><p className="text-sm text-muted-foreground">{aiData.skinCareTips}</p></div>
        )}
        {aiData?.hairCareTips && (
          <div><h4 className="font-semibold mb-1">Hair Care Tips</h4><p className="text-sm text-muted-foreground">{aiData.hairCareTips}</p></div>
        )}
        {aiData?.disclaimer && (
          <p className="text-xs text-muted-foreground italic mt-2">{aiData.disclaimer}</p>
        )}
      </div>
    );
  }

  const days = (plan.diet_plan_days || []).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));

  return (
    <div className="space-y-4">
      <Badge>{plan.status}</Badge>
      <p className="text-sm text-muted-foreground"><strong>Client:</strong> {plan.clients?.name}</p>
      {plan.instructions && <p className="text-sm"><strong>Instructions:</strong> {plan.instructions}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Day</TableHead>
            <TableHead>Breakfast</TableHead>
            <TableHead>Lunch</TableHead>
            <TableHead>Snacks</TableHead>
            <TableHead>Dinner</TableHead>
            <TableHead>Calories</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {days.map((d: any) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium">{d.day_label}</TableCell>
              <TableCell>{d.breakfast_option?.name || '-'}</TableCell>
              <TableCell>{d.lunch_option?.name || '-'}</TableCell>
              <TableCell>{d.snacks_option?.name || '-'}</TableCell>
              <TableCell>{d.dinner_option?.name || '-'}</TableCell>
              <TableCell className="font-semibold">{d.total_calories || 0} kcal</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default SavedDietPlans;

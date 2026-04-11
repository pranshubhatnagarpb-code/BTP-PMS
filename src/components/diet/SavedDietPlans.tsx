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

    const aiData = plan.ai_plan_data as any;
    const clientDetails = {
      name: plan.clients?.name || 'Client',
      age: plan.clients?.date_of_birth ? calculateAge(plan.clients.date_of_birth) : '--',
      gender: plan.clients?.gender || 'Not specified',
      height: plan.clients?.height || '--',
      weight: plan.clients?.weight || '--',
      skinType: plan.clients?.skin_type || 'Not specified',
      hairType: plan.clients?.hair_type || 'Not specified',
      goal: plan.clients?.goal || 'Not specified',
      dietPreference: plan.clients?.diet_preference || 'Not specified',
      healthConditions: plan.clients?.health_conditions || [],
      notes: plan.clients?.notes || '',
    };

    const escapeHtml = (str: string) => str.replace(/\n/g, '<br/>');

    const content = `<!DOCTYPE html>
<html>
<head>
  <title>${aiData.planName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px 35px; color: #333; font-size: 11px; line-height: 1.4; }
    .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #5a7a32; padding-bottom: 15px; }
    .header h1 { color: #5a7a32; font-size: 20px; margin-bottom: 5px; }
    .header p { color: #666; font-size: 12px; }
    .week-badge { display: inline-block; background: #5a7a32; color: white; padding: 3px 8px; border-radius: 12px; font-size: 10px; margin-left: 10px; }
    .client-details { background: #f0f7ff; border: 1px solid #b3d1ff; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
    .client-details h3 { color: #1a5fb4; font-size: 14px; margin-bottom: 10px; }
    .client-details-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 10px; }
    .client-details-grid div { margin-bottom: 5px; }
    .client-details-grid span { font-weight: bold; color: #555; }
    .health-conditions { margin-top: 10px; }
    .health-conditions h4 { font-size: 10px; margin-bottom: 5px; color: #555; }
    .condition-badge { display: inline-block; background: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 10px; font-size: 9px; margin-right: 4px; margin-bottom: 4px; }
    .client-notes { margin-top: 10px; }
    .client-notes h4 { font-size: 10px; margin-bottom: 5px; color: #555; }
    .intro { background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #5a7a32; }
    .intro p { margin: 0; font-style: italic; }
    .section-title { color: #5a7a32; font-size: 16px; font-weight: bold; margin: 25px 0 15px 0; border-bottom: 1px solid #d4e4bc; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
    th { background: #5a7a32; color: white; padding: 8px; text-align: left; font-weight: bold; }
    td { padding: 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
    tr:nth-child(even) { background: #f9f9f9; }
    .affirmations { background: #fef9e7; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f39c12; }
    .affirmations h3 { color: #f39c12; font-size: 14px; margin-bottom: 10px; }
    .affirmations ul { margin-left: 20px; }
    .affirmations li { margin-bottom: 5px; }
    .important-notes { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin-bottom: 20px; }
    .important-notes h4 { color: #856404; font-size: 12px; margin-bottom: 10px; }
    .important-notes ul { margin-left: 15px; }
    .important-notes li { margin-bottom: 5px; font-size: 10px; }
    .tips-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
    .tip-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 10px; }
    .tip-card h4 { font-size: 11px; margin-bottom: 5px; color: #495057; }
    .tip-card p { font-size: 9px; margin: 0; }
    .oil-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px; }
    .oil-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 10px; }
    .oil-card h4 { font-size: 10px; margin-bottom: 5px; color: #333; }
    .oil-note { font-size: 9px; color: #666; font-style: italic; margin: 0; }
    .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 9px; color: #999; }
    @media print {
      body { padding: 15px; }
      .header { margin-bottom: 15px; }
      .section-title { margin: 20px 0 10px 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${aiData.planName}</h1>
    <p>Personalized Diet Plan for ${clientDetails.name}
      <span class="week-badge">Week ${plan.week_number || '--'}</span>
    </p>
  </div>

  <!-- Client KYC Details -->
  <div class="client-details">
    <h3>📋 Client Details</h3>
    <div class="client-details-grid">
      <div><span>Name:</span> ${clientDetails.name}</div>
      <div><span>Age:</span> ${clientDetails.age} years</div>
      <div><span>Gender:</span> ${clientDetails.gender}</div>
      <div><span>Height/Weight:</span> ${clientDetails.height}cm / ${clientDetails.weight}kg</div>
      <div><span>Skin Type:</span> ${clientDetails.skinType}</div>
      <div><span>Hair Type:</span> ${clientDetails.hairType}</div>
      <div><span>Goal:</span> ${clientDetails.goal}</div>
      <div><span>Diet Preference:</span> ${clientDetails.dietPreference}</div>
    </div>
    ${clientDetails.healthConditions.length > 0 ? `
    <div class="health-conditions">
      <h4>Health Conditions:</h4>
      ${clientDetails.healthConditions.map(condition => `<span class="condition-badge">${condition}</span>`).join('')}
    </div>` : ''}
    ${clientDetails.notes ? `
    <div class="client-notes">
      <h4>Notes:</h4>
      <p>${clientDetails.notes}</p>
    </div>` : ''}
  </div>

  <div class="intro">
    <p>${escapeHtml(aiData.introMessage || '')}</p>
  </div>

  ${aiData.affirmations?.length ? `
  <div class="affirmations">
    <h3>Positive Affirmations for ${clientDetails.name}:</h3>
    <ul>
      ${aiData.affirmations.map((a: string) => `<li>${a}</li>`).join('')}
    </ul>
  </div>` : ''}

  ${aiData.dayGroups?.map((group: any) => `
    <h3 class="section-title">📅 ${group.label}${group.dates ? ` <span style="font-size: 12px; color: #666; font-weight: normal;">(${group.dates})</span>` : ''}</h3>
    <table>
      <thead>
        <tr>
          <th style="width: 13%;">Period</th>
          <th style="width: 8%;">Time</th>
          <th style="width: 32%;">Food Plan</th>
          <th style="width: 28%;">Alternative</th>
          <th style="width: 14%;">Notes</th>
        </tr>
      </thead>
      <tbody>
        ${group.meals?.map((meal: any) => `
          <tr>
            <td>${meal.period || '-'}</td>
            <td>${meal.time || '-'}</td>
            <td>${meal.foodPlan || '-'}</td>
            <td>${meal.alternative || '-'}</td>
            <td>${meal.notes || '-'}</td>
          </tr>
        `).join('') || ''}
      </tbody>
    </table>
  `).join('') || ''}

  <h3 class="section-title">Additional Guidelines</h3>
  
  <div class="important-notes" style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; margin-bottom: 20px;">
    <strong>Serving Size:</strong> ${aiData.servingSize || '1 bowl is 250ml, 1 cup 150ml, 1 katori 100ml'}
  </div>

  ${aiData.oilGuidelines ? `
  <div>
    <h4 style="font-size: 11px; color: #333; margin-bottom: 6px;">Use of Oils:</h4>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px;">
      <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 10px;">
        <h4 style="font-size: 10px; margin-bottom: 5px;">Cooking - Group A</h4>
        <ul style="list-style:none;padding:0;margin:0;font-size:9px;">${(aiData.oilGuidelines.cooking?.groupA || []).map((o: string) => `<li>- ${o}</li>`).join('')}</ul>
      </div>
      <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 10px;">
        <h4 style="font-size: 10px; margin-bottom: 5px;">Cooking - Group B</h4>
        <ul style="list-style:none;padding:0;margin:0;font-size:9px;">${(aiData.oilGuidelines.cooking?.groupB || []).map((o: string) => `<li>- ${o}</li>`).join('')}</ul>
      </div>
      <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 10px;">
        <h4 style="font-size: 10px; margin-bottom: 5px;">Raw/Topping</h4>
        <ul style="list-style:none;padding:0;margin:0;font-size:9px;">${(aiData.oilGuidelines.raw || []).map((o: string) => `<li>- ${o}</li>`).join('')}</ul>
      </div>
      <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 10px;">
        <h4 style="font-size: 10px; margin-bottom: 5px;">Deep Frying</h4>
        <ul style="list-style:none;padding:0;margin:0;font-size:9px;">${(aiData.oilGuidelines.deepFrying || []).map((o: string) => `<li>- ${o}</li>`).join('')}</ul>
      </div>
    </div>
    <p style="font-size: 9px; color: #666; font-style: italic; margin: 0;">${aiData.oilGuidelines.note || ''}</p>
  </div>` : ''}

  ${aiData.importantNotes?.length ? `
  <div class="important-notes">
    <h4>⚠️ Important Notes:</h4>
    <ul>
      ${aiData.importantNotes.map((n: string) => `<li>${n}</li>`).join('')}
    </ul>
  </div>` : ''}

  <div class="tips-grid">
    ${aiData.skinCareTips ? `
    <div class="tip-card">
      <h4>🌸 Skin Care Tips</h4>
      <p>${aiData.skinCareTips}</p>
    </div>` : ''}
    ${aiData.hairCareTips ? `
    <div class="tip-card">
      <h4>💇 Hair Care Tips</h4>
      <p>${aiData.hairCareTips}</p>
    </div>` : ''}
    ${aiData.healthNotes ? `
    <div class="tip-card">
      <h4>🏥 Health Notes</h4>
      <p>${aiData.healthNotes}</p>
    </div>` : ''}
    <div class="tip-card">
      <h4>💊 Recommended Supplements</h4>
      <p>${aiData.supplements || 'No supplements specified'}</p>
    </div>
  </div>

  ${aiData.weeklyGroceryList?.length ? `
  <div class="important-notes" style="background: #f0f7ff; border: 1px solid #b3d1ff; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
    <h4 style="color: #1a5fb4; font-size: 14px; margin-bottom: 10px;">🛍️ Weekly Grocery List</h4>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
      ${aiData.weeklyGroceryList.map((cat: any) => `
        <div style="background: white; border: 1px solid #dee2e6; border-radius: 5px; padding: 10px;">
          <h4 style="font-size: 11px; margin-bottom: 5px; color: #1a5fb4;">${cat.category}</h4>
          <ul style="margin: 0; padding-left: 15px; font-size: 9px;">
            ${cat.items.map((item: string) => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
  </div>` : ''}

  ${aiData.disclaimer ? `
  <div class="important-notes">
    <p><strong>Disclaimer:</strong> ${aiData.disclaimer}</p>
  </div>` : ''}

  <div class="footer">
    <p>© 2026 Nutrition Hai Zaruri - Personalized Diet Plan</p>
  </div>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (w) { 
      w.document.write(content); 
      w.document.close(); 
      w.print(); 
    }
    toast.success('PDF generated with consistent formatting!');
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
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {format(new Date(plan.created_at), 'dd MMM yyyy')}</span>
                    <span>{plan.diet_plan_days?.length || 0} days</span>
                    {plan.week_number && <span>Week {plan.week_number}</span>}
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

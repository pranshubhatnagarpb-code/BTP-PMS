import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Trash2, Download, Search, Calendar, User, Copy, Loader2 } from 'lucide-react';
import { useSavedDietPlans, useDeleteDietPlan } from '@/hooks/useDietPlans';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

const SavedDietPlans = () => {
  const { data: plans = [], isLoading, refetch } = useSavedDietPlans();
  const deletePlan = useDeleteDietPlan();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isReusing, setIsReusing] = useState<string | null>(null);

  const handleReusePlan = async (plan: any) => {
    if (!plan.is_ai_generated || !plan.ai_plan_data) {
      toast.error('Only AI-generated plans can be reused');
      return;
    }
    setIsReusing(plan.id);
    try {
      // Find the latest week number for this client
      const { data: existing } = await supabase
        .from('diet_plans')
        .select('week_number')
        .eq('client_id', plan.client_id)
        .eq('is_ai_generated', true)
        .order('week_number', { ascending: false })
        .limit(1);

      const nextWeek = (existing?.[0]?.week_number || 0) + 1;

      const { error } = await supabase
        .from('diet_plans')
        .insert({
          client_id: plan.client_id,
          plan_name: `${(plan.ai_plan_data as any)?.planName || plan.plan_name} - Week ${nextWeek}`,
          instructions: plan.instructions,
          status: 'approved',
          is_ai_generated: true,
          week_number: nextWeek,
          ai_plan_data: plan.ai_plan_data,
        });

      if (error) throw error;
      toast.success(`Plan reused as Week ${nextWeek} for ${plan.clients?.name}!`);
      // Refetch
      refetch();
    } catch (error: any) {
      toast.error('Failed to reuse plan', { description: error.message });
    } finally {
      setIsReusing(null);
    }
  };

  const filtered = plans.filter((plan: any) => {
    const matchesSearch =
      plan.plan_name?.toLowerCase().includes(search.toLowerCase()) ||
      plan.clients?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || plan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this diet plan?')) {
      deletePlan.mutate(id);
    }
  };

  const handleDownloadPDF = (plan: any) => {
    const days = plan.diet_plan_days || [];
    const isAI = plan.is_ai_generated && plan.ai_plan_data;

    let tableContent = '';

    if (isAI) {
      const aiData = plan.ai_plan_data as any;
      const dayGroups = aiData?.dayGroups || [];
      const affirmations = aiData?.affirmations || [];
      const importantNotes = aiData?.importantNotes || [];
      const servingSize = aiData?.servingSize || '';
      const skinCareTips = aiData?.skinCareTips || '';
      const hairCareTips = aiData?.hairCareTips || '';
      const disclaimer = aiData?.disclaimer || '';

      if (affirmations.length > 0) {
        tableContent += `<div style="margin-bottom:20px;padding:15px;background:#f0f4e8;border-radius:8px"><h3 style="color:#4a6528;margin-bottom:8px">Affirmations</h3><ul>${affirmations.map((a: string) => `<li>${a}</li>`).join('')}</ul></div>`;
      }

      dayGroups.forEach((group: any) => {
        tableContent += `<h3 style="margin-top:20px;color:#4a6528">${group.label}</h3>`;
        tableContent += `<table><thead><tr><th>Period</th><th>Time</th><th>Food Plan</th><th>Alternative</th><th>Notes</th></tr></thead><tbody>`;
        (group.meals || []).forEach((meal: any) => {
          tableContent += `<tr><td>${meal.period || '-'}</td><td>${meal.time || '-'}</td><td>${meal.foodPlan || '-'}</td><td>${meal.alternative || '-'}</td><td>${meal.notes || '-'}</td></tr>`;
        });
        tableContent += `</tbody></table>`;
      });

      if (servingSize) tableContent += `<p style="margin-top:15px"><strong>Serving Size:</strong> ${servingSize}</p>`;
      if (importantNotes.length > 0) {
        tableContent += `<div style="margin-top:15px"><h3 style="color:#4a6528">Important Notes</h3><ul>${importantNotes.map((n: string) => `<li>${n}</li>`).join('')}</ul></div>`;
      }
      if (skinCareTips) tableContent += `<div style="margin-top:15px"><h3 style="color:#4a6528">Skin Care Tips</h3><p>${skinCareTips}</p></div>`;
      if (hairCareTips) tableContent += `<div style="margin-top:15px"><h3 style="color:#4a6528">Hair Care Tips</h3><p>${hairCareTips}</p></div>`;
      if (disclaimer) tableContent += `<p style="margin-top:15px;font-style:italic;color:#888">${disclaimer}</p>`;
    } else {
      tableContent = `<table><thead><tr><th>Day</th><th>Breakfast</th><th>Lunch</th><th>Snacks</th><th>Dinner</th><th>Calories</th></tr></thead><tbody>`;
      tableContent += days.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)).map((d: any) => `
        <tr>
          <td>${d.day_label}</td>
          <td>${d.breakfast_option?.name || '-'} ${d.breakfast_option?.calories ? `(${d.breakfast_option.calories} kcal)` : ''}</td>
          <td>${d.lunch_option?.name || '-'} ${d.lunch_option?.calories ? `(${d.lunch_option.calories} kcal)` : ''}</td>
          <td>${d.snacks_option?.name || '-'} ${d.snacks_option?.calories ? `(${d.snacks_option.calories} kcal)` : ''}</td>
          <td>${d.dinner_option?.name || '-'} ${d.dinner_option?.calories ? `(${d.dinner_option.calories} kcal)` : ''}</td>
          <td>${d.total_calories || 0} kcal</td>
        </tr>
      `).join('');
      tableContent += `</tbody></table>`;
    }

    const content = `<html><head><title>Diet Plan - ${plan.clients?.name}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px}h1{color:#5a7a32}h3{color:#4a6528}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#f0f4e8;color:#4a6528}ul{margin:5px 0}</style>
      </head><body>
      <h1>NUTRITION HAI ZARURI</h1>
      <h2>${plan.plan_name}</h2>
      <p><strong>Client:</strong> ${plan.clients?.name || '-'}</p>
      <p><strong>Status:</strong> ${plan.status}</p>
      <p><strong>Created:</strong> ${format(new Date(plan.created_at), 'dd MMM yyyy')}</p>
      ${plan.instructions ? `<p><strong>Instructions:</strong> ${plan.instructions}</p>` : ''}
      ${tableContent}
      <p style="margin-top:30px;color:#666">© 2026 Nutrition Hai Zaruri</p></body></html>`;

    const w = window.open('', '_blank');
    if (w) { w.document.write(content); w.document.close(); w.print(); }
    toast.success('PDF generated!');
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
              <SelectItem value="active">Active</SelectItem>
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
                    <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                      {plan.status}
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReusePlan(plan)}
                      disabled={isReusing === plan.id}
                      title="Reuse this same plan for next week"
                    >
                      {isReusing === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4 mr-1" />}
                      {isReusing === plan.id ? '' : 'Reuse'}
                    </Button>
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
    </div>
  );
};

const PlanDetailView = ({ plan }: { plan: any }) => {
  const isAI = plan.is_ai_generated && plan.ai_plan_data;

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
          <p className="text-sm"><strong>Serving Size:</strong> {aiData.servingSize}</p>
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

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Home, ChevronRight, Plus, FileText, Calendar, Pencil, Trash2, Copy, Eye } from 'lucide-react';
import {
  useDietChartTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  type DietChartTemplate,
  type TemplateDay,
  type TemplateMeal,
} from '@/hooks/useDietChartTemplates';

const CATEGORIES = ['Weight Loss', 'PCOD/PCOS', 'Diabetes', 'Thyroid', 'Muscle Gain', 'General Wellness', 'Pregnancy', 'Post Surgery'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DEFAULT_MEAL: TemplateMeal = { time: '', meal: '', alternatives: '', notes: '' };
const DEFAULT_DAY: TemplateDay = {
  day: 'Monday',
  meals: [
    { time: '7:00 AM', meal: '', alternatives: '', notes: '' },
    { time: '10:00 AM', meal: '', alternatives: '', notes: '' },
    { time: '1:00 PM', meal: '', alternatives: '', notes: '' },
    { time: '4:00 PM', meal: '', alternatives: '', notes: '' },
    { time: '7:00 PM', meal: '', alternatives: '', notes: '' },
  ],
};

const Templates = () => {
  const { data: templates = [], isLoading } = useDietChartTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DietChartTemplate | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<DietChartTemplate | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General Wellness');
  const [instructions, setInstructions] = useState('');
  const [days, setDays] = useState<TemplateDay[]>([{ ...DEFAULT_DAY, meals: DEFAULT_DAY.meals.map(m => ({ ...m })) }]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('General Wellness');
    setInstructions('');
    setDays([{ ...DEFAULT_DAY, meals: DEFAULT_DAY.meals.map(m => ({ ...m })) }]);
    setEditingTemplate(null);
  };

  const openCreate = () => {
    resetForm();
    setIsEditorOpen(true);
  };

  const openEdit = (t: DietChartTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setDescription(t.description || '');
    setCategory(t.category);
    setInstructions(t.instructions || '');
    setDays(t.template_data.length > 0 ? t.template_data : [{ ...DEFAULT_DAY, meals: DEFAULT_DAY.meals.map(m => ({ ...m })) }]);
    setIsEditorOpen(true);
  };

  const openView = (t: DietChartTemplate) => {
    setViewingTemplate(t);
    setIsViewOpen(true);
  };

  const duplicateTemplate = (t: DietChartTemplate) => {
    setEditingTemplate(null);
    setName(`${t.name} (Copy)`);
    setDescription(t.description || '');
    setCategory(t.category);
    setInstructions(t.instructions || '');
    setDays(JSON.parse(JSON.stringify(t.template_data)));
    setIsEditorOpen(true);
  };

  const addDay = () => {
    const usedDays = days.map(d => d.day);
    const nextDay = DAYS.find(d => !usedDays.includes(d)) || DAYS[0];
    setDays([...days, { day: nextDay, meals: DEFAULT_DAY.meals.map(m => ({ ...m })) }]);
  };

  const removeDay = (idx: number) => {
    if (days.length > 1) setDays(days.filter((_, i) => i !== idx));
  };

  const updateDay = (idx: number, field: keyof TemplateDay, value: string) => {
    setDays(days.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const addMeal = (dayIdx: number) => {
    setDays(days.map((d, i) => i === dayIdx ? { ...d, meals: [...d.meals, { ...DEFAULT_MEAL }] } : d));
  };

  const removeMeal = (dayIdx: number, mealIdx: number) => {
    setDays(days.map((d, i) =>
      i === dayIdx ? { ...d, meals: d.meals.filter((_, mi) => mi !== mealIdx) } : d
    ));
  };

  const updateMeal = (dayIdx: number, mealIdx: number, field: keyof TemplateMeal, value: string) => {
    setDays(days.map((d, i) =>
      i === dayIdx
        ? { ...d, meals: d.meals.map((m, mi) => mi === mealIdx ? { ...m, [field]: value } : m) }
        : d
    ));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const payload = { name, description, category, template_data: days, instructions };
    if (editingTemplate) {
      await updateTemplate.mutateAsync({ id: editingTemplate.id, ...payload });
    } else {
      await createTemplate.mutateAsync(payload);
    }
    setIsEditorOpen(false);
    resetForm();
  };

  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  return (
    <DashboardLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Diet Chart Templates</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diet Chart Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Create reusable diet chart templates to quickly assign to clients</p>
        </div>
        <Button className="gradient-primary text-primary-foreground" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-12 text-center shadow-card">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No templates yet</h3>
          <p className="text-muted-foreground mb-4">Create your first diet chart template to get started</p>
          <Button className="gradient-primary text-primary-foreground" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> Create Template
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="p-6 shadow-card hover:shadow-card-hover transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <FileText className="h-6 w-6 text-secondary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground mb-1 truncate">{t.name}</h3>
                  <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground mb-2">
                    {t.category}
                  </span>
                  {t.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{t.description}</p>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{t.template_data.length} day(s) · Updated {new Date(t.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => openView(t)}>
                  <Eye className="h-4 w-4 mr-1" /> View
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => duplicateTemplate(t)}>
                  <Copy className="h-4 w-4 mr-1" /> Duplicate
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive ml-auto"
                  onClick={() => deleteTemplate.mutate(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={(open) => { if (!open) { setIsEditorOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create New Template'}</DialogTitle>
            <DialogDescription>Define meals, timings, and alternatives for each day</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Meta */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Weight Loss Diet Chart" />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>General Instructions</Label>
              <Textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="e.g., Drink 8 glasses of water daily, avoid fried food..." rows={2} />
            </div>

            {/* Days */}
            {days.map((day, dayIdx) => (
              <Card key={dayIdx} className="p-4 border-border">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Select value={day.day} onValueChange={v => updateDay(dayIdx, 'day', v)}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">{day.meals.length} meals</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => addMeal(dayIdx)}>
                      <Plus className="h-3 w-3 mr-1" /> Meal
                    </Button>
                    {days.length > 1 && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeDay(dayIdx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {day.meals.map((meal, mealIdx) => (
                    <div key={mealIdx} className="grid grid-cols-12 gap-2 items-start">
                      <Input
                        className="col-span-2"
                        value={meal.time}
                        onChange={e => updateMeal(dayIdx, mealIdx, 'time', e.target.value)}
                        placeholder="Time"
                      />
                      <Input
                        className="col-span-4"
                        value={meal.meal}
                        onChange={e => updateMeal(dayIdx, mealIdx, 'meal', e.target.value)}
                        placeholder="Meal (e.g., Oats with milk + 1 banana)"
                      />
                      <Input
                        className="col-span-3"
                        value={meal.alternatives}
                        onChange={e => updateMeal(dayIdx, mealIdx, 'alternatives', e.target.value)}
                        placeholder="Alternatives"
                      />
                      <Input
                        className="col-span-2"
                        value={meal.notes}
                        onChange={e => updateMeal(dayIdx, mealIdx, 'notes', e.target.value)}
                        placeholder="Notes"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="col-span-1 text-destructive h-10"
                        onClick={() => removeMeal(dayIdx, mealIdx)}
                        disabled={day.meals.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            ))}

            <Button variant="outline" onClick={addDay} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Add Day
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditorOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || !name.trim()} className="gradient-primary text-primary-foreground">
              {isSaving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingTemplate?.name}</DialogTitle>
            <DialogDescription>
              {viewingTemplate?.category} · {viewingTemplate?.template_data.length} day(s)
            </DialogDescription>
          </DialogHeader>

          {viewingTemplate?.description && (
            <p className="text-sm text-muted-foreground">{viewingTemplate.description}</p>
          )}
          {viewingTemplate?.instructions && (
            <div className="p-3 rounded-md bg-accent/50">
              <p className="text-sm font-medium text-accent-foreground">Instructions:</p>
              <p className="text-sm text-muted-foreground">{viewingTemplate.instructions}</p>
            </div>
          )}

          {viewingTemplate?.template_data.map((day, idx) => (
            <div key={idx} className="space-y-2">
              <h4 className="font-semibold text-foreground">{day.day}</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Time</TableHead>
                    <TableHead>Meal</TableHead>
                    <TableHead>Alternatives</TableHead>
                    <TableHead className="w-32">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {day.meals.map((meal, mi) => (
                    <TableRow key={mi}>
                      <TableCell className="font-medium">{meal.time || '-'}</TableCell>
                      <TableCell>{meal.meal || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{meal.alternatives || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{meal.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsViewOpen(false); if (viewingTemplate) openEdit(viewingTemplate); }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Templates;

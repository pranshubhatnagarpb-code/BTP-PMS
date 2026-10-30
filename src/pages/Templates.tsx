import { useState, Fragment, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Home, ChevronRight, Plus, FileText, Calendar, Pencil, Trash2, Copy, Eye, RefreshCw, Check, X, Undo2, FileUp } from 'lucide-react';
import {
  useDietChartTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  type DietChartTemplate,
  type TemplateDay,
  type TemplateMeal,
} from '@/hooks/useDietChartTemplates';
import { useDraftRecovery, saveWithDraftFallback } from '@/hooks/useDraftRecovery';
import { WEEKLY_MENU_LABEL } from '@/lib/manualDietPlan';
import { DraftRecoveryDialog } from '@/components/ui/DraftRecoveryDialog';
import { ImportPlanTemplateDialog, type ImportedTemplateDraft } from '@/components/diet/ImportPlanTemplateDialog';

// Tabular layout interfaces
interface TemplateMealTimeRow {
  time: string;
  mealKey: string;
  dayMeals: {
    [dayIndex: number]: TemplateMeal;
  };
}

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

  const { drafts, saveDraft, getDraft, clearDraft, hasDraft } = useDraftRecovery('template');

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DietChartTemplate | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<DietChartTemplate | null>(null);
  const [showDaySyncDialog, setShowDaySyncDialog] = useState(false);
  const [sourceDayIndex, setSourceDayIndex] = useState<number | null>(null);
  const [targetDayIndex, setTargetDayIndex] = useState<string>('all');
  const [syncContext, setSyncContext] = useState<'edit' | 'view'>('edit');
  const [editingMealTime, setEditingMealTime] = useState<number | null>(null);
  const [mealTimeEditValue, setMealTimeEditValue] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Filter templates based on search
  const filteredTemplates = templates.filter(template => {
    if (!searchFilter) return true;
    const searchLower = searchFilter.toLowerCase();
    return template.name.toLowerCase().includes(searchLower) ||
           template.description?.toLowerCase().includes(searchLower) ||
           template.category.toLowerCase().includes(searchLower);
  });
  
  // Draft recovery state
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const initialDataRef = useRef<any>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General Wellness');
  const [instructions, setInstructions] = useState('');
  const [days, setDays] = useState<TemplateDay[]>([{ ...DEFAULT_DAY, meals: DEFAULT_DAY.meals.map(m => ({ ...m })) }]);
  const daysHistoryRef = useRef<TemplateDay[][]>([]);
  const [canUndoDays, setCanUndoDays] = useState(false);

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
    
    // Store initial data for change detection
    initialDataRef.current = {
      name: '',
      description: '',
      category: 'General Wellness',
      instructions: '',
      days: [{ ...DEFAULT_DAY, meals: DEFAULT_DAY.meals.map(m => ({ ...m })) }]
    };
    
    setHasUnsavedChanges(false);
    
    // Check for drafts after a short delay
    setTimeout(checkForDrafts, 100);
  };

  // A plan imported from a PDF / Word file, opened in the editor before saving.
  const [importOpen, setImportOpen] = useState(false);
  const openImported = (draft: ImportedTemplateDraft) => {
    resetForm();
    setName(draft.name);
    setCategory(draft.category);
    setInstructions(draft.instructions);
    setDays(draft.days);
    setIsEditorOpen(true);
    // Compared against the empty form, so closing without saving asks first.
    initialDataRef.current = {
      name: '',
      description: '',
      category: 'General Wellness',
      instructions: '',
      days: [{ ...DEFAULT_DAY, meals: DEFAULT_DAY.meals.map(m => ({ ...m })) }]
    };
    setHasUnsavedChanges(true);
  };

  const openEdit = (t: DietChartTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setDescription(t.description || '');
    setCategory(t.category);
    setInstructions(t.instructions || '');
    setDays(t.template_data.length > 0 ? t.template_data : [{ ...DEFAULT_DAY, meals: DEFAULT_DAY.meals.map(m => ({ ...m })) }]);
    setIsEditorOpen(true);
    
    // Store initial data for change detection
    initialDataRef.current = {
      name: t.name,
      description: t.description || '',
      category: t.category,
      instructions: t.instructions || '',
      days: t.template_data
    };
    
    setHasUnsavedChanges(false);
    
    // Check for drafts after a short delay
    setTimeout(checkForDrafts, 100);
  };

  const openView = (t: DietChartTemplate) => {
    setViewingTemplate(t);
    setIsViewOpen(true);
  };

  // Check for unsaved changes
  const checkUnsavedChanges = () => {
    if (!initialDataRef.current) return false;
    
    const current = {
      name,
      description,
      category,
      instructions,
      days
    };
    
    return JSON.stringify(current) !== JSON.stringify(initialDataRef.current);
  };

  // Save draft before unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isEditorOpen && checkUnsavedChanges()) {
        const draftId = editingTemplate ? `template-${editingTemplate.id}` : `template-new-${Date.now()}`;
        const draftData = {
          name,
          description,
          category,
          instructions,
          template_data: days
        };
        
        // Only save if there's actual content to save
        if (JSON.stringify(draftData) !== JSON.stringify({
          name: '',
          description: '',
          category: 'General Wellness',
          instructions: '',
          template_data: [{ ...DEFAULT_DAY, meals: DEFAULT_DAY.meals.map(m => ({ ...m })) }]
        })) {
          saveDraft(draftId, draftData);
          e.preventDefault();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEditorOpen, name, description, category, instructions, days, editingTemplate]);

  // Track changes for unsaved changes detection
  useEffect(() => {
    if (isEditorOpen && initialDataRef.current) {
      setHasUnsavedChanges(checkUnsavedChanges());
    }
  }, [name, description, category, instructions, days, isEditorOpen]);

  const duplicateTemplate = (t: DietChartTemplate) => {
    setEditingTemplate(null);
    setName(`${t.name} (Copy)`);
    setDescription(t.description || '');
    setCategory(t.category);
    setInstructions(t.instructions || '');
    setDays(JSON.parse(JSON.stringify(t.template_data)));
    setIsEditorOpen(true);
  };

  // Sync meal timings from first day to all other days
  const syncMealTimings = () => {
    if (days.length < 2) {
      alert('Need at least 2 days to sync meal timings');
      return;
    }
    pushDaysHistory();
    const firstDayMeals = days[0].meals;
    const updatedDays = days.map((day, index) => {
      if (index === 0) return day; // Skip first day
      
      return {
        ...day,
        meals: day.meals.map((meal, mealIndex) => ({
          ...meal,
          time: firstDayMeals[mealIndex]?.time || meal.time
        }))
      };
    });

    setDays(updatedDays);
    alert('Meal timings synced to all days successfully!');
  };

  const pushDaysHistory = () => {
    daysHistoryRef.current = [...daysHistoryRef.current.slice(-49), JSON.parse(JSON.stringify(days))];
    setCanUndoDays(true);
  };

  const undoDays = () => {
    if (daysHistoryRef.current.length === 0) return;
    const prev = daysHistoryRef.current[daysHistoryRef.current.length - 1];
    daysHistoryRef.current = daysHistoryRef.current.slice(0, -1);
    setDays(prev);
    setCanUndoDays(daysHistoryRef.current.length > 0);
  };

  const addDay = () => {
    pushDaysHistory();
    const usedDays = days.map(d => d.day);
    const nextDay = DAYS.find(d => !usedDays.includes(d)) || DAYS[0];
    setDays([...days, { day: nextDay, meals: DEFAULT_DAY.meals.map(m => ({ ...m })) }]);
  };

  const removeDay = (idx: number) => {
    if (days.length > 1) { pushDaysHistory(); setDays(days.filter((_, i) => i !== idx)); }
  };

  const updateDay = (idx: number, field: keyof TemplateDay, value: string) => {
    pushDaysHistory();
    setDays(days.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const addMeal = (dayIdx: number) => {
    pushDaysHistory();
    setDays(days.map((d, i) => i === dayIdx ? { ...d, meals: [...d.meals, { ...DEFAULT_MEAL }] } : d));
  };

  const removeMeal = (dayIdx: number, mealIdx: number) => {
    pushDaysHistory();
    setDays(days.map((d, i) =>
      i === dayIdx ? { ...d, meals: d.meals.filter((_, mi) => mi !== mealIdx) } : d
    ));
  };

  const updateMeal = (dayIdx: number, mealTimeIdx: number, field: keyof TemplateMeal, value: string) => {
    console.log('updateMeal called:', { dayIdx, mealTimeIdx, field, value });
    pushDaysHistory();
    setDays(prevDays => {
      const newDays = prevDays.map((d, i) => {
        if (i === dayIdx) {
          // Ensure the meal exists at the specified index
          const updatedMeals = [...d.meals];
          
          // If meal doesn't exist at this index, create it
          while (updatedMeals.length <= mealTimeIdx) {
            updatedMeals.push({ time: '', meal: '', alternatives: '', notes: '' });
            console.log(`Added meal at index ${updatedMeals.length - 1} for day ${i}`);
          }
          
          // Update the specific meal field
          updatedMeals[mealTimeIdx] = { ...updatedMeals[mealTimeIdx], [field]: value };
          
          return { ...d, meals: updatedMeals };
        }
        return d;
      });
      console.log('Days updated:', newDays);
      return newDays;
    });
  };

  // Meal time editing functions
  const startEditMealTime = (mealTimeIdx: number) => {
    const meal = days[0]?.meals[mealTimeIdx];
    if (meal) {
      setMealTimeEditValue(meal.time);
      setEditingMealTime(mealTimeIdx);
    }
  };

  const saveMealTime = () => {
    if (editingMealTime === null) return;
    pushDaysHistory();
    // Update all days with the new meal time
    const updatedDays = days.map(day => ({
      ...day,
      meals: day.meals.map((meal, idx) => 
        idx === editingMealTime 
          ? { ...meal, time: mealTimeEditValue }
          : meal
      )
    }));

    setDays(updatedDays);
    setEditingMealTime(null);
    setMealTimeEditValue('');
  };

  const cancelEditMealTime = () => {
    setEditingMealTime(null);
    setMealTimeEditValue('');
  };

  // Sync individual meal content across all days
  const syncMealAcrossDays = (mealTimeIdx: number) => {
    if (days.length < 2) {
      alert('Need at least 2 days to sync meals');
      return;
    }
    
    const sourceMeal = days[0].meals[mealTimeIdx]; // Use first day as source
    pushDaysHistory();
    // Update the same meal position in all other days
    const updatedDays = days.map((day, dayIdx) => {
      if (dayIdx !== 0 && mealTimeIdx < day.meals.length) {
        const newMeals = [...day.meals];
        newMeals[mealTimeIdx] = { ...sourceMeal };
        return { ...day, meals: newMeals };
      }
      return day;
    });
    
    setDays(updatedDays);
    alert('Meal synced across all days successfully!');
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const payload = { name, description, category, template_data: days, instructions };
    const draftId = editingTemplate ? `template-${editingTemplate.id}` : `template-new-${Date.now()}`;
    
    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({ id: editingTemplate.id, ...payload });
        // Clear draft immediately after successful save
        clearDraft(draftId);
      } else {
        await createTemplate.mutateAsync(payload);
        // Clear all new template drafts after successful creation
        const newDrafts = drafts.filter(d => d.id.startsWith('template-new-'));
        newDrafts.forEach(draft => clearDraft(draft.id));
      }
      setIsEditorOpen(false);
      resetForm();
      setHasUnsavedChanges(false);
      initialDataRef.current = null;
    } catch (error) {
      console.error('Save failed, creating draft:', error);
      // Save draft only on failure
      saveDraft(draftId, {
        name,
        description,
        category,
        instructions,
        template_data: days
      });
      throw error;
    }
  };

  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  // Draft recovery functions
  const checkForDrafts = () => {
    if (editingTemplate) {
      const draft = getDraft(`template-${editingTemplate.id}`);
      if (draft) {
        // Check if draft has different content than current template
        const currentData = {
          name: editingTemplate.name,
          description: editingTemplate.description || '',
          category: editingTemplate.category,
          instructions: editingTemplate.instructions || '',
          template_data: editingTemplate.template_data
        };
        
        if (JSON.stringify(currentData) !== JSON.stringify(draft.data)) {
          setShowDraftDialog(true);
        }
      }
    } else {
      // Check for new template drafts
      const newDrafts = drafts.filter(d => d.id.startsWith('template-new-'));
      if (newDrafts.length > 0) {
        // Only show dialog if we're not already in a clean state
        const currentData = {
          name: '',
          description: '',
          category: 'General Wellness',
          instructions: '',
          template_data: [{ ...DEFAULT_DAY, meals: DEFAULT_DAY.meals.map(m => ({ ...m })) }]
        };
        
        // Show dialog for the most recent draft if it has content
        const recentDraft = newDrafts.sort((a, b) => b.lastModified - a.lastModified)[0];
        if (recentDraft && JSON.stringify(currentData) !== JSON.stringify(recentDraft.data)) {
          setShowDraftDialog(true);
        }
      }
    }
  };

  const restoreDraft = (draft: any) => {
    const draftData = draft.data;
    setName(draftData.name || '');
    setDescription(draftData.description || '');
    setCategory(draftData.category || 'General Wellness');
    setInstructions(draftData.instructions || '');
    setDays(draftData.template_data || [{ ...DEFAULT_DAY, meals: DEFAULT_DAY.meals.map(m => ({ ...m })) }]);
    
    if (editingTemplate) {
      setEditingTemplate({ ...editingTemplate, ...draftData });
    }
    
    // Clear the draft after restoration
    clearDraft(draft.id);
    setShowDraftDialog(false);
    setHasUnsavedChanges(true);
    
    // Store initial data for change detection (the restored draft data)
    initialDataRef.current = {
      name: draftData.name || '',
      description: draftData.description || '',
      category: draftData.category || 'General Wellness',
      instructions: draftData.instructions || '',
      days: draftData.template_data || [{ ...DEFAULT_DAY, meals: DEFAULT_DAY.meals.map(m => ({ ...m })) }]
    };
  };

  const deleteDraft = (draftId: string) => {
    clearDraft(draftId);
  };

  // Day-wise sync function for templates
  const syncDayToAnother = (sourceIdx: number, targetIdx: string, context: 'edit' | 'view') => {
    if (sourceIdx === null) return;
    
    const sourceDay = context === 'edit' ? days[sourceIdx] : viewingTemplate?.template_data[sourceIdx];
    if (!sourceDay) return;
    
    if (context === 'edit') {
      // Sync in edit mode
      if (targetIdx === 'all') {
        // Sync to all other days
        pushDaysHistory();
        const updated = days.map((day, idx) => {
          if (idx !== sourceIdx) {
            return { ...day, meals: [...sourceDay.meals] };
          }
          return day;
        });
        setDays(updated);
      } else {
        // Sync to specific day
        const targetIdxNum = parseInt(targetIdx);
        if (targetIdxNum !== sourceIdx && targetIdxNum < days.length) {
          pushDaysHistory();
          const updated = [...days];
          updated[targetIdxNum] = { ...updated[targetIdxNum], meals: [...sourceDay.meals] };
          setDays(updated);
        }
      }
    } else {
      // Sync in view mode - create a new template for editing
      if (targetIdx === 'all') {
        const updated = viewingTemplate!.template_data.map((day, idx) => {
          if (idx !== sourceIdx) {
            return { ...day, meals: [...sourceDay.meals] };
          }
          return day;
        });
        // Open in edit mode with synced data
        setEditingTemplate(null);
        setName(`${viewingTemplate!.name} (Synced)`);
        setDescription(viewingTemplate!.description || '');
        setCategory(viewingTemplate!.category);
        setInstructions(viewingTemplate!.instructions || '');
        setDays(updated);
        setIsEditorOpen(true);
        setIsViewOpen(false);
      } else {
        const targetIdxNum = parseInt(targetIdx);
        if (targetIdxNum !== sourceIdx && targetIdxNum < viewingTemplate!.template_data.length) {
          const updated = [...viewingTemplate!.template_data];
          updated[targetIdxNum] = { ...updated[targetIdxNum], meals: [...sourceDay.meals] };
          // Open in edit mode with synced data
          setEditingTemplate(null);
          setName(`${viewingTemplate!.name} (Synced)`);
          setDescription(viewingTemplate!.description || '');
          setCategory(viewingTemplate!.category);
          setInstructions(viewingTemplate!.instructions || '');
          setDays(updated);
          setIsEditorOpen(true);
          setIsViewOpen(false);
        }
      }
    }
    
    setShowDaySyncDialog(false);
    setSourceDayIndex(null);
    setTargetDayIndex('all');
  };

  // Data transformation functions for tabular layout
  const transformTemplateToTabularFormat = (): TemplateMealTimeRow[] => {
    if (days.length === 0) return [];
    
    // Get all unique meal times from the first day (as base)
    const firstDayMeals = days[0].meals;
    const mealTimeRows: TemplateMealTimeRow[] = [];
    
    firstDayMeals.forEach((meal, mealIndex) => {
      const mealKey = `${meal.time}`;
      const dayMeals: { [dayIndex: number]: TemplateMeal } = {};
      
      // Collect this meal time from all days
      days.forEach((dayGroup, dayIndex) => {
        if (dayGroup.meals[mealIndex]) {
          dayMeals[dayIndex] = dayGroup.meals[mealIndex];
        } else {
          // Create empty meal if this day doesn't have this meal time
          dayMeals[dayIndex] = {
            time: meal.time,
            meal: '',
            alternatives: '',
            notes: ''
          };
        }
      });
      
      mealTimeRows.push({
        time: meal.time,
        mealKey,
        dayMeals
      });
    });
    
    return mealTimeRows;
  };

  const getTemplateMealTimeDisplay = (time: string): string => {
    return time;
  };

  // Tabular meal management functions
  const addMealTime = (position?: number) => {
    pushDaysHistory();
    const newMeal: TemplateMeal = {
      time: '12:00 PM',
      meal: 'Click to add meal',
      alternatives: '',
      notes: ''
    };
    
    console.log('addMealTime called:', { position, currentDaysLength: days[0]?.meals.length });
    
    setDays(prevDays => {
      const maxMealCount = Math.max(...prevDays.map(day => day.meals.length));
      console.log('Current max meal count:', maxMealCount);
      
      return prevDays.map((day, dayIndex) => {
        const updatedMeals = [...day.meals];
        
        // Ensure this day has meals up to the current max
        while (updatedMeals.length < maxMealCount) {
          updatedMeals.push({ time: '', meal: '', alternatives: '', notes: '' });
          console.log(`Padded day ${dayIndex} to meal index ${updatedMeals.length - 1}`);
        }
        
        if (position !== undefined) {
          // Insert at specific position
          updatedMeals.splice(position, 0, newMeal);
          console.log(`Inserted meal at position ${position} for day ${dayIndex}`);
        } else {
          // Add to end
          updatedMeals.push(newMeal);
          console.log(`Added meal at end for day ${dayIndex}, new length: ${updatedMeals.length}`);
        }
        
        return { ...day, meals: updatedMeals };
      });
    });
  };

  // Helper function to ensure all days have meals at all positions
  const ensureMealSynchronization = () => {
    setDays(prevDays => {
      const maxMealCount = Math.max(...prevDays.map(day => day.meals.length));
      console.log('Ensuring meal synchronization, max count:', maxMealCount);
      
      return prevDays.map((day, dayIndex) => {
        if (day.meals.length < maxMealCount) {
          const updatedMeals = [...day.meals];
          while (updatedMeals.length < maxMealCount) {
            updatedMeals.push({ time: '', meal: '', alternatives: '', notes: '' });
            console.log(`Synced day ${dayIndex} to meal index ${updatedMeals.length - 1}`);
          }
          return { ...day, meals: updatedMeals };
        }
        return day;
      });
    });
  };

  // Ensure meal synchronization when days change
  useEffect(() => {
    if (days.length > 0) {
      ensureMealSynchronization();
    }
  }, [days.length]); // Only re-run when the number of days changes

  const removeMealTime = (mealTimeIdx: number) => {
    console.log('Removing meal time at index:', mealTimeIdx);
    pushDaysHistory();
    setDays(prevDays => 
      prevDays.map(day => ({
        ...day,
        meals: day.meals.filter((_, index) => index !== mealTimeIdx)
      }))
    );
  };

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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)} title="Make a template from an existing plan's PDF or Word file (no AI)">
            <FileUp className="h-4 w-4 mr-2" />
            Import from plan
          </Button>
          <Button className="gradient-primary text-primary-foreground" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Input
            placeholder="Search templates by name, description, or category..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-10"
          />
          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Diet Chart Templates</h2>
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{filteredTemplates.length}</span> 
                {filteredTemplates.length === 1 ? ' template' : ' templates'}
                {searchFilter && ` matching "${searchFilter}"`}
              </p>
            </div>
          </div>
          {filteredTemplates.length === 0 ? (
            <Card className="p-12 text-center shadow-card">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchFilter ? 'No templates found' : 'No templates yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchFilter 
                  ? `No templates match "${searchFilter}". Try a different search term.` 
                  : 'Create your first diet chart template to get started'
                }
              </p>
              <Button 
                className="gradient-primary text-primary-foreground" 
                onClick={() => searchFilter ? setSearchFilter('') : openCreate()}
              >
                <Plus className="h-4 w-4 mr-2" /> {searchFilter ? 'Clear Search' : 'Create Template'}
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((t) => (
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
        </>
      )}

      {/* Editor Full Screen */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b px-6 py-4 flex items-center justify-between bg-card">
              <div>
                <h2 className="text-xl font-bold">{editingTemplate ? 'Edit Template' : 'Create New Template'}</h2>
                <p className="text-sm text-muted-foreground">Define meals, timings, and alternatives for each day</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { setIsEditorOpen(false); resetForm(); }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">

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

            {/* Tabular Template Layout */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-primary text-sm">Template Diet Chart</h4>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-6 px-2 text-xs"
                    onClick={addDay}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Day
                  </Button>
                  {!(days.length === 1 && days[0].day === WEEKLY_MENU_LABEL) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-xs"
                      title="One menu for the whole week, options labelled 2/WEEK, ON THU... (keeps the first day's meals)"
                      onClick={() => {
                        if (days.length > 1 && !window.confirm('A weekly menu has one column for the whole week. Keep the first day and remove the others?')) return;
                        pushDaysHistory();
                        setDays([{ ...days[0], day: WEEKLY_MENU_LABEL }]);
                      }}
                    >
                      Weekly menu
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  {days.map((day, dayIdx) => (
                    <div key={dayIdx} className="flex items-center gap-1">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-6 px-2 text-xs"
                        onClick={() => {
                          const newDay = prompt('Edit day label:', day.day);
                          if (newDay && newDay !== day.day) {
                            pushDaysHistory();
                            const updated = [...days];
                            updated[dayIdx] = { ...day, day: newDay };
                            setDays(updated);
                          }
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {days.length > 1 && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => removeDay(dayIdx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground">
                Weekly menu format: put each option on its own line with a line <strong>OR</strong> between options; start an
                option with a label such as <strong>2/WEEK:</strong>, <strong>ON THU:</strong> or <strong>THU (fast day):</strong>;
                items had with every option go first, followed by a line <strong>+</strong>. Notes print as a full-width row under the meal.
              </p>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="bg-warning text-warning-foreground">
                      <th className="text-left p-2 font-semibold text-xs w-[20%] sticky left-0 bg-warning">Meal Time</th>
                      {days.map((day, dayIdx) => (
                        <th key={dayIdx} className="text-left p-2 font-semibold text-xs min-w-[150px]">
                          <div className="space-y-1">
                            <div 
                              className="cursor-pointer hover:text-primary hover:bg-muted/30 px-1 py-0.5 rounded transition-colors"
                              onClick={() => {
                                const newDay = prompt('Edit day label:', day.day);
                                if (newDay && newDay !== day.day) {
                                  pushDaysHistory();
                                  const updated = [...days];
                                  updated[dayIdx] = { ...day, day: newDay };
                                  setDays(updated);
                                }
                              }}
                              title="Click to edit day name"
                            >
                              {day.day}
                            </div>
                            {days.length > 1 && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-5 px-1 text-xs text-primary hover:bg-primary/10"
                                onClick={() => {
                                  setSourceDayIndex(dayIdx);
                                  setTargetDayIndex('all');
                                  setSyncContext('edit');
                                  setShowDaySyncDialog(true);
                                }}
                                title={`Sync ${day.day} to other days`}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Sync
                              </Button>
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="text-left p-2 font-semibold text-xs w-[8%] sticky right-0 bg-warning">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {days[0]?.meals.map((_, mealTimeIdx) => (
                      <Fragment key={mealTimeIdx}>
                        <tr className={mealTimeIdx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                          <td className="p-2 font-medium text-foreground text-xs sticky left-0 bg-card">
                            {editingMealTime === mealTimeIdx ? (
                              <div className="flex items-center gap-1">
                                <Input 
                                  value={mealTimeEditValue} 
                                  onChange={e => setMealTimeEditValue(e.target.value)} 
                                  className="text-xs h-7 px-2 py-1 min-w-[80px]" 
                                  placeholder="Time"
                                  autoFocus
                                />
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveMealTime}>
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditMealTime}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <div 
                                className="cursor-pointer hover:text-primary hover:bg-muted/30 px-1 py-0.5 rounded transition-colors flex items-center gap-1 group" 
                                onClick={() => startEditMealTime(mealTimeIdx)}
                              >
                                {days[0]?.meals[mealTimeIdx]?.time || ''}
                                <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            )}
                          </td>
                          {days.map((day, dayIdx) => {
                            // Ensure meal exists at this index - if not, create it immediately
                            let meal = day.meals[mealTimeIdx];
                            if (!meal) {
                              console.log(`Meal missing at index ${mealTimeIdx} for day ${dayIdx}, creating it`);
                              // Create the missing meal immediately to ensure state connection
                              setDays(prevDays => 
                                prevDays.map((d, i) => {
                                  if (i === dayIdx) {
                                    const updatedMeals = [...d.meals];
                                    while (updatedMeals.length <= mealTimeIdx) {
                                      updatedMeals.push({ time: '', meal: '', alternatives: '', notes: '' });
                                    }
                                    return { ...d, meals: updatedMeals };
                                  }
                                  return d;
                                })
                              );
                              meal = { time: '', meal: '', alternatives: '', notes: '' };
                            }
                            return (
                              <td key={dayIdx} className="p-2 border-l">
                                <div className="space-y-1">
                                  {/* Multi-line so weekly-menu options can be written with OR / + lines */}
                                  <Textarea
                                    value={meal.meal}
                                    onChange={e => updateMeal(dayIdx, mealTimeIdx, 'meal', e.target.value)}
                                    placeholder="Meal"
                                    rows={Math.min(8, Math.max(1, (meal.meal || '').split('\n').length))}
                                    className="text-sm min-h-9 px-3 py-2 min-w-[180px] resize-y"
                                  />
                                  <Textarea
                                    value={meal.alternatives}
                                    onChange={e => updateMeal(dayIdx, mealTimeIdx, 'alternatives', e.target.value)}
                                    placeholder="Alternatives"
                                    rows={Math.min(6, Math.max(1, (meal.alternatives || '').split('\n').length))}
                                    className="text-sm min-h-9 px-3 py-2 min-w-[180px] resize-y"
                                  />
                                  <Input
                                    value={meal.notes}
                                    onChange={e => updateMeal(dayIdx, mealTimeIdx, 'notes', e.target.value)}
                                    placeholder="Notes"
                                    className="text-sm h-9 px-3 py-2 min-w-[180px]"
                                  />
                                </div>
                              </td>
                            );
                          })}
                          <td className="p-2 sticky right-0 bg-card">
                            <div className="flex gap-1">
                              {days.length > 1 && (
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                                  onClick={() => syncMealAcrossDays(mealTimeIdx)}
                                  title="Sync this meal time to all days"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              )}
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-100"
                                onClick={() => removeMealTime(mealTimeIdx)}
                                title="Remove meal time"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {/* Add meal row between existing meals */}
                        <tr className="bg-primary/5">
                          <td colSpan={days.length + 2} className="p-1 text-center">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-xs text-primary hover:bg-primary/10 h-6 px-2"
                              onClick={() => addMealTime(mealTimeIdx + 1)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Meal Time Here
                            </Button>
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex justify-center">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs border-primary/20 text-primary hover:bg-primary/10"
                  onClick={() => addMealTime()}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Meal Time
                </Button>
              </div>
            </div>
          </div>

            </div>

            {/* Footer */}
            <div className="border-t px-6 py-4 bg-card flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={undoDays}
                disabled={!canUndoDays}
                title="Undo last change"
              >
                <Undo2 className="h-4 w-4 mr-1" />
                Undo
              </Button>
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={() => { setIsEditorOpen(false); resetForm(); }}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving || !name.trim()} className="gradient-primary text-primary-foreground">
                  {isSaving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Full Screen */}
      {isViewOpen && (
        <div className="fixed inset-0 z-50 bg-background">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="border-b px-6 py-4 flex items-center justify-between bg-card">
              <div>
                <h2 className="text-xl font-bold">{viewingTemplate?.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {viewingTemplate?.category} · {viewingTemplate?.template_data.length} day(s)
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsViewOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">

          {viewingTemplate?.description && (
            <p className="text-sm text-muted-foreground">{viewingTemplate.description}</p>
          )}
          {viewingTemplate?.instructions && (
            <div className="p-3 rounded-md bg-accent/50">
              <p className="text-sm font-medium text-accent-foreground">Instructions:</p>
              <p className="text-sm text-muted-foreground">{viewingTemplate.instructions}</p>
            </div>
          )}

          {/* Tabular Template View */}
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-warning text-warning-foreground">
                  <th className="text-left p-2 font-semibold text-xs w-[20%] sticky left-0 bg-warning">Meal Time</th>
                  {viewingTemplate?.template_data.map((day, dayIdx) => (
                    <th key={dayIdx} className="text-left p-2 font-semibold text-xs min-w-[150px]">
                      <div>
                        {day.day}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Transform template data to tabular format for viewing
                  if (!viewingTemplate || viewingTemplate.template_data.length === 0) return [];
                  
                  const firstDayMeals = viewingTemplate.template_data[0].meals;
                  const mealTimeRows: { time: string; dayMeals: { [dayIndex: number]: any } }[] = [];
                  
                  firstDayMeals.forEach((meal, mealIndex) => {
                    const dayMeals: { [dayIndex: number]: any } = {};
                    
                    viewingTemplate.template_data.forEach((dayGroup, dayIndex) => {
                      if (dayGroup.meals[mealIndex]) {
                        dayMeals[dayIndex] = dayGroup.meals[mealIndex];
                      } else {
                        dayMeals[dayIndex] = { time: meal.time, meal: '', alternatives: '', notes: '' };
                      }
                    });
                    
                    mealTimeRows.push({
                      time: meal.time,
                      dayMeals
                    });
                  });
                  
                  return mealTimeRows;
                })().map((mealTimeRow, mealTimeIdx) => (
                  <tr key={mealTimeIdx} className={mealTimeIdx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                    <td className="p-2 font-medium text-foreground text-xs sticky left-0 bg-card">
                      {mealTimeRow.time}
                    </td>
                    {viewingTemplate?.template_data.map((day, dayIdx) => {
                      const meal = mealTimeRow.dayMeals[dayIdx];
                      return (
                        <td key={dayIdx} className="p-2 border-l">
                          <div className="space-y-1">
                            <div className="font-medium whitespace-pre-line">{meal.meal || '-'}</div>
                            <div className="text-sm text-muted-foreground whitespace-pre-line">{meal.alternatives || '-'}</div>
                            <div className="text-sm text-muted-foreground">{meal.notes || '-'}</div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

            </div>

            {/* Footer */}
            <div className="border-t px-6 py-4 bg-card flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => { setIsViewOpen(false); if (viewingTemplate) openEdit(viewingTemplate); }}>
                <Pencil className="h-4 w-4 mr-2" /> Edit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Day Sync Dialog */}
      {showDaySyncDialog && (
        <Dialog open={showDaySyncDialog} onOpenChange={setShowDaySyncDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Sync Day Meal Plan</DialogTitle>
              <DialogDescription>
                {syncContext === 'edit' 
                  ? "Copy this day's meal plan to other days in the current template"
                  : "Create a new template with this day's meal plan synced to other days"
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Source Day</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {sourceDayIndex !== null && (
                    syncContext === 'edit' 
                      ? days[sourceDayIndex]?.day
                      : viewingTemplate?.template_data[sourceDayIndex]?.day
                  )}
                </p>
              </div>

              <div>
                <Label htmlFor="target-day" className="text-sm font-medium">Sync To</Label>
                <Select value={targetDayIndex} onValueChange={setTargetDayIndex}>
                  <SelectTrigger id="target-day" className="mt-1">
                    <SelectValue placeholder="Select target day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Other Days</SelectItem>
                    {(syncContext === 'edit' ? days : viewingTemplate?.template_data)?.map((day, idx) => (
                      idx !== sourceDayIndex && (
                        <SelectItem key={idx} value={idx.toString()}>
                          {day.day}
                        </SelectItem>
                      )
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-700">
                  {syncContext === 'edit' 
                    ? (targetDayIndex === 'all' 
                        ? "This will copy the entire meal plan from this day to all other days, replacing their current meals."
                        : `This will copy the entire meal plan from this day to the selected day, replacing its current meals.`
                      )
                    : (targetDayIndex === 'all'
                        ? "This will create a new template with this day's meal plan copied to all other days."
                        : "This will create a new template with this day's meal plan copied to the selected day."
                      )
                  }
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowDaySyncDialog(false);
                  setSourceDayIndex(null);
                  setTargetDayIndex('all');
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => sourceDayIndex !== null && syncDayToAnother(sourceDayIndex, targetDayIndex, syncContext)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Copy className="h-4 w-4 mr-2" />
                {syncContext === 'edit' ? 'Sync Day' : 'Create Synced Template'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ImportPlanTemplateDialog open={importOpen} onOpenChange={setImportOpen} categories={CATEGORIES} onEdit={openImported} />

      {/* Draft Recovery Dialog */}
      <DraftRecoveryDialog
        open={showDraftDialog}
        onClose={() => setShowDraftDialog(false)}
        drafts={drafts}
        onRestoreDraft={restoreDraft}
        onDeleteDraft={deleteDraft}
      />
    </DashboardLayout>
  );
};

export default Templates;

import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sparkles, Download, Loader2, Pencil, Check, X, CheckCircle2, Plus, Trash2, Save, CalendarIcon, BookTemplate, RefreshCw, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Client } from '@/hooks/useClients';
import { useDietChartTemplates, type DietChartTemplate, type TemplateDay, type TemplateMeal } from '@/hooks/useDietChartTemplates';
import { format, addDays, startOfWeek } from 'date-fns';

interface MealItem {
  period: string;
  time: string;
  foodPlan: string;
  alternative: string;
  notes: string;
  isManuallyAdded?: boolean; // Track if this row was manually added
}

interface DayGroup {
  label: string;
  dates?: string;
  editable?: boolean;
  meals: MealItem[];
}

interface OilGuidelines {
  cooking: { groupA: string[]; groupB: string[] };
  raw: string[];
  deepFrying: string[];
  note: string;
}

interface GroceryCategory {
  category: string;
  items: string[];
}

interface DietPlan {
  planName: string;
  introMessage: string;
  affirmations: string[];
  dayGroups: DayGroup[];
  servingSize: string;
  oilGuidelines: OilGuidelines;
  importantNotes: string[];
  disclaimer: string;
  skinCareTips: string;
  hairCareTips: string;
  healthNotes: string;
  supplements: string;
  weeklyGroceryList: GroceryCategory[];
}

interface Props {
  clients: Client[];
  editModeData?: { id: string; data: DietPlan & { clientId?: string }; source: 'draft' | 'reuse' | 'template'; clientId?: string } | null;
  onClose?: () => void;
}

export const AIDietPlanGenerator = ({ clients, editModeData, onClose }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<DietPlan | null>(null);
  const [hasGeneratedPlan, setHasGeneratedPlan] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true); // Add loading state for restoration
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [numberOfDays, setNumberOfDays] = useState('7');
  const [nextDietChartNumber, setNextDietChartNumber] = useState(1);
  const [editingCell, setEditingCell] = useState<{ groupIdx: number; mealIdx: number; field: 'foodPlan' | 'notes' | 'alternative' | 'period' | 'time' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editFieldValue, setEditFieldValue] = useState('');
  const [editingGroceryCategory, setEditingGroceryCategory] = useState<{ catIdx: number; value: string } | null>(null);
  const [groceryEditValue, setGroceryEditValue] = useState('');
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [editingImportantNotes, setEditingImportantNotes] = useState(false);
  const [importantNotesValue, setImportantNotesValue] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [showDraftOptions, setShowDraftOptions] = useState(false);
  const [editSource, setEditSource] = useState<'draft' | 'reuse' | 'template' | 'new' | null>(null);
  const [originalPlanData, setOriginalPlanData] = useState<DietPlan | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showReuseOptions, setShowReuseOptions] = useState(false);
  const [reuseSourceClientId, setReuseSourceClientId] = useState('');
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [selectedReusePlan, setSelectedReusePlan] = useState<any>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [supplements, setSupplements] = useState('');
  const [showTemplateOptions, setShowTemplateOptions] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DietChartTemplate | null>(null);
  const [customTitle, setCustomTitle] = useState(''); // Add custom title state
  const { data: templates = [], isLoading: loadingTemplates } = useDietChartTemplates();
  const [showDaySyncDialog, setShowDaySyncDialog] = useState(false);
  const [sourceDayIndex, setSourceDayIndex] = useState<number | null>(null);
  const [targetDayIndex, setTargetDayIndex] = useState<string>('all');

  // Session storage key for diet plan
  const DIET_PLAN_STORAGE_KEY = 'ai_diet_plan_generator_plan';
  const DIET_PLAN_CLIENT_KEY = 'ai_diet_plan_generator_client';

  // Utility function to calculate age from date of birth
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

  // Generate day labels based on selected start date and number of days
  const generateDayLabels = () => {
    if (!startDate) {
      // Fallback to default Monday-Sunday if no date selected
      console.log('No start date selected, using default Monday-Sunday');
      return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    }
    
    const labels = [];
    const currentDate = new Date(startDate);
    const days = parseInt(numberOfDays);
    
    console.log('Generating day labels from:', { startDate, numberOfDays: days });
    
    for (let i = 0; i < days; i++) {
      const dayName = format(currentDate, 'EEEE');
      const dateStr = format(currentDate, 'MMM dd');
      const label = `${dayName} (${dateStr})`;
      labels.push(label);
      console.log(`Day ${i + 1}: ${label}`);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log('Final day labels:', labels);
    return labels;
  };

  // Generate diet chart label - simplified format
  const getDietChartLabel = () => {
    return `Diet Chart ${nextDietChartNumber}`;
  };

  // Generate full plan name with custom title if provided
  const getFullPlanName = () => {
    const baseName = getDietChartLabel();
    if (customTitle.trim()) {
      return `${baseName} - ${customTitle.trim()}`;
    }
    return baseName;
  };

  // Restore plan from session storage on mount
  useEffect(() => {
    const savedPlan = sessionStorage.getItem(DIET_PLAN_STORAGE_KEY);
    const savedClientId = sessionStorage.getItem(DIET_PLAN_CLIENT_KEY);
    
    if (savedPlan) {
      try {
        const plan = JSON.parse(savedPlan);
        console.log('Restoring plan from session storage:', plan);
        setGeneratedPlan(plan);
        setHasGeneratedPlan(true);
      } catch (error) {
        console.error('Error parsing saved plan:', error);
        sessionStorage.removeItem(DIET_PLAN_STORAGE_KEY);
      }
    }
    
    // Restore client selection
    if (savedClientId && clients.length > 0) {
      const client = clients.find(c => c.id === savedClientId);
      if (client) {
        console.log('Restoring client from session storage:', client);
        setSelectedClientId(savedClientId);
        setSelectedClient(client);
      }
    }
    
    // Restoration complete
    setIsRestoring(false);
  }, [clients]); // Add clients dependency so it re-runs when clients are loaded

  // Save to session storage when plan changes
  useEffect(() => {
    if (generatedPlan) {
      console.log('Saving plan to session storage:', generatedPlan);
      sessionStorage.setItem(DIET_PLAN_STORAGE_KEY, JSON.stringify(generatedPlan));
    } else if (!generatedPlan && hasGeneratedPlan) {
      // Plan was cleared, remove from storage
      console.log('Removing plan and client from session storage');
      sessionStorage.removeItem(DIET_PLAN_STORAGE_KEY);
      sessionStorage.removeItem(DIET_PLAN_CLIENT_KEY);
    }
  }, [generatedPlan, hasGeneratedPlan]);

  // Save client to session storage when client changes
  useEffect(() => {
    if (selectedClientId) {
      console.log('Saving client to session storage:', selectedClientId);
      sessionStorage.setItem(DIET_PLAN_CLIENT_KEY, selectedClientId);
    } else {
      console.log('Removing client from session storage');
      sessionStorage.removeItem(DIET_PLAN_CLIENT_KEY);
    }
  }, [selectedClientId]);

  // Auto-populate supplements when client is selected
  useEffect(() => {
    if (selectedClient && selectedClient.supplements) {
      setSupplements(selectedClient.supplements);
    } else if (selectedClient && !selectedClient.supplements) {
      setSupplements('');
    }
  }, [selectedClient]);

  // Handle edit mode initialization
  useEffect(() => {
    if (editModeData) {
      console.log('Initializing edit mode:', editModeData);
      setEditingPlanId(editModeData.id);
      setGeneratedPlan({ ...editModeData.data });
      setOriginalPlanData(editModeData.data);
      setHasGeneratedPlan(true);
      setIsEditMode(true);
      setEditSource(editModeData.source);
      setIsOpen(true);
      
      // Set the client using the clientId from editModeData
      const clientId = editModeData.clientId || editModeData.data.clientId;
      if (clientId) {
        const client = clients.find(c => c.id === clientId);
        if (client) {
          setSelectedClientId(clientId);
          setSelectedClient(client);
          console.log('Set client for edit mode:', client.name);
        } else {
          console.warn('Client not found for ID:', clientId);
          // Fallback to first client
          if (clients.length > 0) {
            setSelectedClientId(clients[0].id);
            setSelectedClient(clients[0]);
          }
        }
      } else {
        console.warn('No client ID found in editModeData');
        // Fallback to first client
        if (clients.length > 0) {
          setSelectedClientId(clients[0].id);
          setSelectedClient(clients[0]);
        }
      }
    }
  }, [editModeData, clients]);

  // Update day labels when start date or number of days changes
  useEffect(() => {
    // This effect will trigger regeneration of day labels when needed
    if (startDate && numberOfDays) {
      console.log('Day labels will be generated based on:', { startDate, numberOfDays });
    }
  }, [numberOfDays, startDate]);

  const handleClientSelect = async (clientId: string) => {
    console.log('handleClientSelect called with clientId:', clientId);
    setSelectedClientId(clientId);
    const client = clients.find(c => c.id === clientId) || null;
    console.log('Found client:', client);
    setSelectedClient(client);
    
    // Auto-populate additional instructions with health conditions and notes
    if (client) {
      // Health conditions should always be an array now
      const healthConditions = client.health_conditions || [];
      
      const healthConditionsText = healthConditions.length > 0 
        ? `Health Conditions: ${healthConditions.join(', ')}`
        : '';
      
      const notesText = client.notes ? `Client Notes: ${client.notes}` : '';
      
      const autoGeneratedText = [healthConditionsText, notesText]
        .filter(Boolean)
        .join('\n');
      
      // Always update client-specific information while preserving additional instructions
      if (customPrompt.trim()) {
        // Check if current prompt has existing client info that needs to be replaced
        const lines = customPrompt.split('\n');
        const filteredLines = lines.filter(line => 
          !line.startsWith('Health Conditions:') && 
          !line.startsWith('Client Notes:') &&
          !line.startsWith('Notes:')
        );
        
        // Combine existing instructions with new client info
        const existingInstructions = filteredLines.join('\n').trim();
        const newPrompt = existingInstructions 
          ? `${autoGeneratedText}\n\n${existingInstructions}`
          : autoGeneratedText;
        
        setCustomPrompt(newPrompt);
      } else {
        // If prompt is empty, just set the auto-generated text
        setCustomPrompt(autoGeneratedText);
      }
    } else {
      setCustomPrompt('');
    }
    
    // Fetch the latest diet chart number for this client
    const { data, error } = await supabase
      .from('diet_plans')
      .select('week_number') // We'll repurpose this field for diet chart numbering
      .eq('client_id', clientId)
      .eq('is_ai_generated', true)
      .eq('status', 'approved')
      .order('week_number', { ascending: false })
      .limit(1);
    
    if (!error && data && data.length > 0) {
      setNextDietChartNumber((data[0].week_number || 0) + 1);
    } else {
      setNextDietChartNumber(1);
    }
  };

  const getClientDetails = () => {
    if (!selectedClient) return null;
    if (!selectedClient.height || !selectedClient.weight) { toast.error('Client must have height and weight set'); return null; }
    if (!selectedClient.gender) { toast.error('Client must have gender set'); return null; }
    if (!selectedClient.goal) { toast.error('Client must have health goal set'); return null; }

    return {
      name: selectedClient.name,
      goal: selectedClient.goal as 'weight_loss' | 'weight_gain' | 'maintain',
      height: selectedClient.height,
      weight: selectedClient.weight,
      age: calculateAge(selectedClient.date_of_birth),
      gender: selectedClient.gender as 'male' | 'female' | 'other',
      skinType: selectedClient.skin_type || 'Not specified',
      hairType: selectedClient.hair_type || 'Not specified',
      healthConditions: selectedClient.health_conditions || [],
      dietPreference: (selectedClient.diet_preference === 'non-vegetarian' ? 'non-vegetarian' :
        selectedClient.diet_preference === 'vegetarian' ? 'vegetarian' : 'both') as 'vegetarian' | 'non-vegetarian' | 'both',
      notes: selectedClient.notes || '',
      supplements: supplements || '',
    };
  };

  const generatePlan = async () => {
    const clientDetails = getClientDetails();
    if (!clientDetails) return;
    
    // Reset reuse state when generating new plan
    setEditSource('new');
    setSelectedReusePlan(null);
    
    // Show confirmation if there's already a generated plan
    if (generatedPlan) {
      setShowClearConfirmation(true);
      return;
    }
    
    setIsGenerating(true);
    try {
      const dayLabels = generateDayLabels();
      console.log('Sending to AI:', { 
        startDate, 
        numberOfDays, 
        dayLabels,
        clientName: clientDetails.name 
      });
      
      const response = await fetch('/api/diet-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          clientDetails, 
          customPrompt: customPrompt.trim() || undefined, 
          numberOfDays: parseInt(numberOfDays),
          startDate: startDate.toISOString().split('T')[0] // Send start date to backend
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Failed to generate diet plan');
      if (!data?.dietPlan) throw new Error('No plan Generated');
      
      console.log('AI Response:', data.dietPlan);
      
      setGeneratedPlan(data.dietPlan);
      setHasGeneratedPlan(true);
      toast.success('Diet plan generated successfully!');
    } catch (error: any) {
      console.error('Error generating plan:', error);
      toast.error('Failed to generate diet plan', { description: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  // Convert template data to diet plan format
  const convertTemplateToDietPlan = (template: DietChartTemplate): DietPlan => {
    const dayGroups = template.template_data.map((templateDay, index) => {
      // Convert template meals to diet plan meals
      const meals: MealItem[] = templateDay.meals.map((templateMeal: TemplateMeal) => ({
        period: templateMeal.time || '',
        time: templateMeal.time || '',
        foodPlan: templateMeal.meal || '',
        alternative: templateMeal.alternatives || '',
        notes: templateMeal.notes || ''
      }));

      return {
        label: templateDay.day || `Day ${index + 1}`,
        dates: '', // Will be populated by user
        editable: true,
        meals
      };
    });

    return {
      planName: `Diet Plan from Template: ${template.name}`,
      introMessage: template.description || `Diet plan based on ${template.name} template. ${template.instructions || ''}`,
      affirmations: [
        "I nourish my body with wholesome foods.",
        "Every meal is a step towards my health goals.",
        "I choose foods that empower and energize me."
      ],
      dayGroups,
      servingSize: "1 bowl is 250ml, 1 cup 150ml, 1 katori 100ml",
      oilGuidelines: {
        cooking: {
          groupA: ["olive oil - 2 tsp each", "coconut oil - 2 tsp each"],
          groupB: ["ghee - 1-2 tsp each", "mustard oil - 1-2 tsp each"]
        },
        raw: ["flaxseed oil - 1 tsp each", "olive oil for salads - 1 tsp each"],
        deepFrying: ["sunflower oil - for occasional use"],
        note: "All oils must be unrefined/cold pressed. Total should not exceed 4-5 tsp a day."
      },
      importantNotes: [
        "Drink 2-3 liters of water throughout the day",
        "Chew food thoroughly and eat mindfully",
        "Avoid processed foods and excess sugar"
      ],
      disclaimer: "This diet plan is personalized and should be followed as advised. Please consult with your healthcare provider before making any significant dietary changes.",
      skinCareTips: "Maintain healthy skin by staying hydrated and eating antioxidant-rich foods.",
      hairCareTips: "Support hair health with adequate protein and essential nutrients.",
      healthNotes: "Follow this plan consistently for best results. Listen to your body and adjust as needed.",
      supplements: supplements || 'No supplements specified',
      weeklyGroceryList: [
        { category: "Vegetables", items: ["Fresh seasonal vegetables", "Leafy greens", "Cruciferous vegetables"] },
        { category: "Fruits", items: ["Seasonal fruits", "Berries", "Citrus fruits"] },
        { category: "Grains & Pulses", items: ["Brown rice", "Quinoa", "Lentils", "Beans"] },
        { category: "Dairy", items: ["Curd", "Paneer", "Milk"] },
        { category: "Spices & Condiments", items: ["Turmeric", "Cumin", "Coriander", "Ginger", "Garlic"] },
        { category: "Others", items: ["Nuts", "Seeds", "Honey", "Jaggery"] }
      ]
    };
  };

  // Use template function
  const useTemplate = (template: DietChartTemplate) => {
    const dietPlan = convertTemplateToDietPlan(template);
    setGeneratedPlan(dietPlan);
    setHasGeneratedPlan(true);
    setEditSource('template');
    setSelectedTemplate(template);
    setShowTemplateOptions(false);
    toast.success(`Template "${template.name}" loaded successfully!`);
  };

  const approvePlan = async () => {
    if (!generatedPlan || !selectedClientId) return;
    setIsApproving(true);
    try {
      const insertData: any = {
        client_id: selectedClientId,
        plan_name: getFullPlanName(),
        instructions: generatedPlan.introMessage,
        status: 'approved',
        is_ai_generated: true,
        week_number: nextDietChartNumber, // Keep for numbering but not display
        custom_title: customTitle.trim() || null,
        ai_plan_data: generatedPlan as any,
      };

      // Add reuse source information if applicable
      if (editSource === 'reuse' && selectedReusePlan) {
        insertData.source_client_id = selectedReusePlan.client_id;
        insertData.source_plan_id = selectedReusePlan.id;
        insertData.reused_from = selectedReusePlan.plan_name;
      }

      const { error } = await supabase
        .from('diet_plans')
        .insert(insertData);

      if (error) throw error;
      
      const successMessage = editSource === 'reuse' 
        ? `Plan reused and saved as ${getFullPlanName()}!`
        : `Plan approved & saved as ${getFullPlanName()}!`;
      
      toast.success(successMessage);
      setNextDietChartNumber(prev => prev + 1);
    } catch (error: any) {
      console.error('Error approving plan:', error);
      toast.error('Failed to approve plan', { description: error.message });
    } finally {
      setIsApproving(false);
    }
  };

  // Editing helpers
  const startEditCell = (groupIdx: number, mealIdx: number, field: 'foodPlan' | 'notes' | 'alternative' | 'period' | 'time') => {
    if (!generatedPlan) return;
    setEditingCell({ groupIdx, mealIdx, field });
    setEditValue(generatedPlan.dayGroups[groupIdx].meals[mealIdx][field]);
  };

  const saveEditCell = () => {
    if (!generatedPlan || !editingCell) return;
    const updated = { ...generatedPlan };
    
    // Update meal only in specific group (no auto-sync)
    updated.dayGroups = updated.dayGroups.map((g, gi) =>
      gi === editingCell.groupIdx
        ? { ...g, meals: g.meals.map((m, mi) => mi === editingCell.mealIdx ? { ...m, [editingCell.field]: editValue } : m) }
        : g
    );
    
    setGeneratedPlan(updated);
    setEditingCell(null);
  };

  // Grocery list editing helpers
  const startEditGroceryCategory = (catIdx: number, field: 'category' | 'items', value: string) => {
    if (!generatedPlan) return;
    setEditingGroceryCategory({ catIdx, field });
    setGroceryEditValue(value);
  };

  const saveEditGroceryCategory = () => {
    if (!generatedPlan || !editingGroceryCategory) return;
    const updated = { ...generatedPlan };
    
    if (editingGroceryCategory.field === 'category') {
      updated.weeklyGroceryList = updated.weeklyGroceryList?.map((cat, ci) =>
        ci === editingGroceryCategory.catIdx ? { ...cat, category: groceryEditValue } : cat
      );
    } else if (editingGroceryCategory.field === 'items') {
      updated.weeklyGroceryList = updated.weeklyGroceryList?.map((cat, ci) =>
        ci === editingGroceryCategory.catIdx ? { ...cat, items: groceryEditValue.split('\n').filter(item => item.trim()) } : cat
      );
    }
    
    setGeneratedPlan(updated);
    setEditingGroceryCategory(null);
    setGroceryEditValue('');
  };

  // Meal row management helpers
  const addMealRow = (groupIdx: number, position?: number) => {
    if (!generatedPlan) return;
    const updated = { ...generatedPlan };
    const newMeal: MealItem = {
      period: 'New Meal',
      time: '12:00 PM',
      foodPlan: 'Click to add food plan',
      alternative: '',
      notes: ''
    };
    
    // Add meal only to specific group
    updated.dayGroups = updated.dayGroups.map((g, gi) => {
      if (gi === groupIdx) {
        if (position !== undefined) {
          // Insert at specific position
          const newMeals = [...g.meals];
          newMeals.splice(position, 0, newMeal);
          return { ...g, meals: newMeals };
        } else {
          // Add to end
          return { ...g, meals: [...g.meals, newMeal] };
        }
      }
      return g;
    });
    
    setGeneratedPlan(updated);
  };

  const removeMealRow = (groupIdx: number, mealIdx: number) => {
    if (!generatedPlan) return;
    const updated = { ...generatedPlan };
    
    // Remove meal only from specific group
    updated.dayGroups = updated.dayGroups.map((g, gi) =>
      gi === groupIdx 
        ? { ...g, meals: g.meals.filter((_, mi) => mi !== mealIdx) }
        : g
    );
    
    setGeneratedPlan(updated);
  };

  // Sync individual meal content across all day groups
  const syncMealAcrossGroups = (groupIdx: number, mealIdx: number) => {
    if (!generatedPlan) return;
    const updated = { ...generatedPlan };
    const sourceMeal = generatedPlan.dayGroups[groupIdx].meals[mealIdx];
    
    // Update the same meal position in all other day groups
    updated.dayGroups = updated.dayGroups.map((g, gi) => {
      if (gi !== groupIdx && mealIdx < g.meals.length) {
        const newMeals = [...g.meals];
        newMeals[mealIdx] = { ...sourceMeal, isManuallyAdded: false }; // Keep as AI-generated
        return { ...g, meals: newMeals };
      }
      return g;
    });
    
    setGeneratedPlan(updated);
    toast.success('Meal synced across all day groups');
  };

  // Day-wise sync function
  const syncDayToAnother = (sourceIdx: number, targetIdx: string) => {
    if (!generatedPlan || sourceIdx === null) return;
    
    const updated = { ...generatedPlan };
    const sourceDay = updated.dayGroups[sourceIdx];
    
    if (targetIdx === 'all') {
      // Sync to all other days
      updated.dayGroups = updated.dayGroups.map((day, idx) => {
        if (idx !== sourceIdx) {
          return { ...day, meals: [...sourceDay.meals] };
        }
        return day;
      });
      toast.success(`Day ${sourceDay.label} synced to all other days`);
    } else {
      // Sync to specific day
      const targetIdxNum = parseInt(targetIdx);
      if (targetIdxNum !== sourceIdx && targetIdxNum < updated.dayGroups.length) {
        updated.dayGroups[targetIdxNum] = { ...updated.dayGroups[targetIdxNum], meals: [...sourceDay.meals] };
        toast.success(`Day ${sourceDay.label} synced to ${updated.dayGroups[targetIdxNum].label}`);
      }
    }
    
    setGeneratedPlan(updated);
    setShowDaySyncDialog(false);
    setSourceDayIndex(null);
    setTargetDayIndex('all');
  };

  const startEditField = (field: string, value: string) => {
    setEditingField(field);
    setEditFieldValue(value);
  };

  const saveEditField = () => {
    if (!generatedPlan || !editingField) return;
    setGeneratedPlan({ ...generatedPlan, [editingField]: editFieldValue });
    setEditingField(null);
  };

  // Important notes editing helpers
  const startEditImportantNotes = () => {
    if (!generatedPlan?.importantNotes) return;
    setEditingImportantNotes(true);
    setImportantNotesValue(generatedPlan.importantNotes.join('\n'));
  };

  const saveImportantNotes = () => {
    if (!generatedPlan) return;
    const updated = { ...generatedPlan };
    updated.importantNotes = importantNotesValue.split('\n').filter(note => note.trim());
    setGeneratedPlan(updated);
    setEditingImportantNotes(false);
    setImportantNotesValue('');
  };

  // Fetch available diet plans from other clients for reuse
  const fetchAvailablePlans = async (sourceClientId: string) => {
    if (!sourceClientId) {
      setAvailablePlans([]);
      return;
    }

    setLoadingPlans(true);
    try {
      const { data, error } = await supabase
        .from('diet_plans')
        .select('*')
        .eq('client_id', sourceClientId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailablePlans(data || []);
    } catch (error: any) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to fetch diet plans');
      setAvailablePlans([]);
    } finally {
      setLoadingPlans(false);
    }
  };

  // Handle reuse source client change
  const handleReuseSourceClientChange = (clientId: string) => {
    setReuseSourceClientId(clientId);
    setSelectedReusePlan(null);
    fetchAvailablePlans(clientId);
  };

  // Load selected diet plan for reuse
  const loadPlanForReuse = (plan: any) => {
    setSelectedReusePlan(plan);
    const planData = plan.ai_plan_data;
    
    // Update plan name to reflect new client
    const updatedPlan = {
      ...planData,
      planName: planData.planName.replace(/for\s+.+$/, `for ${selectedClient?.name || 'Client'}`),
    };
    
    setGeneratedPlan(updatedPlan);
    setHasGeneratedPlan(true);
    setShowReuseOptions(false);
    setEditSource('reuse');
    toast.success(`Loaded plan from ${plan.plan_name} for editing`);
  };

  // Save plan as draft
  const saveAsDraft = async () => {
    if (!generatedPlan || !selectedClient) return;
    
    try {
      const { error } = await supabase
        .from('diet_plans')
        .insert({
          client_id: selectedClient.id,
          week_number: nextDietChartNumber,
          plan_name: `${getFullPlanName()} (Draft)`,
          custom_title: customTitle.trim() || null,
          ai_plan_data: generatedPlan as any,
          status: 'draft',
          is_ai_generated: true,
          created_at: new Date().toISOString(),
        });
      
      if (error) throw error;
      
      toast.success('Plan saved as draft!');
      setShowDraftOptions(false);
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
    }
  };

  // Start editing a saved plan (draft or approved)
  const startEditPlan = (planId: string, planData: DietPlan, source: 'draft' | 'reuse') => {
    setEditingPlanId(planId);
    setGeneratedPlan({ ...planData }); // Create a copy to avoid mutating original
    setOriginalPlanData(planData); // Store original for comparison
    setHasGeneratedPlan(true);
    setIsEditMode(true);
    setEditSource(source);
    setIsOpen(true);
  };

  // Save draft as approved plan
  const approveDraft = async () => {
    console.log('approveDraft called', { generatedPlan, editingPlanId, selectedClient });
    if (!generatedPlan || !editingPlanId || !selectedClient) {
      toast.error('Missing required data for approval');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('diet_plans')
        .update({
          plan_name: getFullPlanName(),
          custom_title: customTitle.trim() || null,
          ai_plan_data: generatedPlan as any,
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingPlanId);
      
      if (error) throw error;
      
      toast.success(`Draft approved and saved as ${getFullPlanName()}!`);
      resetEditMode();
    } catch (error: any) {
      console.error('Error approving draft:', error);
      toast.error('Failed to approve draft');
    }
  };

  // Save reused plan as new approved plan
  const saveReusedPlan = async () => {
    console.log('saveReusedPlan called', { generatedPlan, selectedClient, nextDietChartNumber });
    if (!generatedPlan || !selectedClient) {
      toast.error('Missing required data for saving');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('diet_plans')
        .insert({
          client_id: selectedClient.id,
          week_number: nextDietChartNumber,
          plan_name: getFullPlanName(),
          custom_title: customTitle.trim() || null,
          ai_plan_data: generatedPlan as any,
          status: 'approved',
          is_ai_generated: true,
          created_at: new Date().toISOString(),
        });
      
      if (error) throw error;
      
      toast.success(`Reused plan saved as ${getFullPlanName()}!`);
      resetEditMode();
    } catch (error: any) {
      console.error('Error saving reused plan:', error);
      toast.error('Failed to save reused plan');
    }
  };

  // Reset edit mode
  const resetEditMode = () => {
    setIsEditMode(false);
    setEditingPlanId(null);
    setEditSource(null);
    setOriginalPlanData(null);
    setGeneratedPlan(null);
    setHasGeneratedPlan(false);
    if (onClose) {
      onClose();
    }
  };

  // Update edited plan (for drafts)
  const updateEditedPlan = async () => {
    if (!generatedPlan || !editingPlanId || !selectedClient) return;
    
    try {
      const { error } = await supabase
        .from('diet_plans')
        .update({
          ai_plan_data: generatedPlan as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingPlanId);
      
      if (error) throw error;
      
      toast.success('Plan updated successfully!');
      resetEditMode();
    } catch (error: any) {
      console.error('Error updating plan:', error);
      toast.error('Failed to update plan');
    }
  };

  // Cancel edit mode
  const cancelEdit = () => {
    resetEditMode();
  };

  const generatePDF = () => {
    console.log('generatePDF called', { generatedPlan, selectedClient });
    if (!generatedPlan || !selectedClient) {
      toast.error('Missing plan or client data for PDF generation');
      return;
    }
    const clientDetails = getClientDetails();
    if (!clientDetails) {
      toast.error('Unable to get client details for PDF');
      return;
    }
    console.log('Generating PDF with client details:', clientDetails);

    const escapeHtml = (str: string) => str.replace(/\n/g, '<br/>');

    const dayGroupTables = generatedPlan.dayGroups.map(group => `
      <h3 style="font-size: 14px; color: #5a7a32; font-weight: 700; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #d4e4bc;">📅 ${group.label}${group.dates ? ` <span style="font-size: 12px; color: #666; font-weight: normal;">(${group.dates})</span>` : ''}</h3>
      <table>
        <thead>
          <tr>
            <th style="width: 13%;">Period</th>
            <th style="width: 8%;">Time</th>
            <th style="width: 34%;">Food Plan</th>
            <th style="width: 30%;">Alternative</th>
            <th style="width: 15%;">Notes</th>
          </tr>
        </thead>
        <tbody>
          ${group.meals.map(meal => `
            <tr>
              <td class="period-cell">${meal.period}</td>
              <td class="time-cell">${meal.time}</td>
              <td class="food-cell">${escapeHtml(meal.foodPlan)}</td>
              <td class="food-cell" style="color: #666; font-style: italic;">${escapeHtml(meal.alternative || '-')}</td>
              <td class="notes-cell">${escapeHtml(meal.notes)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `).join('');

    const content = `<!DOCTYPE html>
<html>
<head>
  <title>${generatedPlan.planName}</title>
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
    .serving-size { background: #e8f5e8; padding: 10px; border-radius: 5px; margin-bottom: 15px; font-size: 10px; }
    .oil-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 15px; }
    .oil-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 10px; }
    .oil-card h4 { font-size: 11px; margin-bottom: 5px; color: #495057; }
    .oil-card ul { list-style: none; padding: 0; margin: 0; }
    .oil-card li { font-size: 9px; margin-bottom: 2px; }
    .oil-note { font-style: italic; font-size: 9px; color: #6c757d; margin-top: 5px; }
    .important-notes { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin-bottom: 20px; }
    .important-notes h4 { color: #856404; font-size: 12px; margin-bottom: 10px; }
    .important-notes ul { margin-left: 15px; }
    .important-notes li { margin-bottom: 5px; font-size: 10px; }
    .grocery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
    .grocery-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 10px; }
    .grocery-card h4 { font-size: 11px; margin-bottom: 5px; color: #495057; }
    .grocery-card ul { list-style: none; padding: 0; margin: 0; }
    .grocery-card li { font-size: 9px; margin-bottom: 2px; }
    .tips-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
    .tip-card { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 10px; }
    .tip-card h4 { font-size: 11px; margin-bottom: 5px; color: #495057; }
    .tip-card p { font-size: 9px; margin: 0; }
    .disclaimer { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 10px; margin-top: 20px; font-size: 9px; font-style: italic; color: #6c757d; }
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
    <h1>${generatedPlan.planName}</h1>
    <p>Personalized Diet Plan for ${clientDetails.name}
      <span class="week-badge">${getFullPlanName()}</span>
    </p>
  </div>

  <!-- Client KYC Details -->
  <div class="client-details">
    <h3>📋 Client Details</h3>
    <div class="client-details-grid">
      <div><span>Name:</span> ${clientDetails.name}</div>
      <div><span>Age:</span> ${clientDetails.age} years</div>
      <div><span>Gender:</span> ${clientDetails.gender || 'Not specified'}</div>
      <div><span>Height/Weight:</span> ${clientDetails.height || '--'}cm / ${clientDetails.weight || '--'}kg</div>
      <div><span>Skin Type:</span> ${clientDetails.skinType || 'Not specified'}</div>
      <div><span>Hair Type:</span> ${clientDetails.hairType || 'Not specified'}</div>
      <div><span>Goal:</span> ${clientDetails.goal || 'Not specified'}</div>
      <div><span>Diet Preference:</span> ${clientDetails.dietPreference || 'Not specified'}</div>
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
    <p>${escapeHtml(generatedPlan.introMessage)}</p>
  </div>

  ${generatedPlan.affirmations?.length ? `
  <div class="affirmations">
    <h3>Positive Affirmations for ${clientDetails.name}:</h3>
    <ul>
      ${generatedPlan.affirmations.map(a => `<li>${a}</li>`).join('')}
    </ul>
  </div>` : ''}

  ${dayGroupTables}

  <h3 class="section-title">Additional Guidelines</h3>
  
  <div class="serving-size">
    <strong>Serving Size:</strong> ${generatedPlan.servingSize || '1 bowl is 250ml, 1 cup 150ml, 1 katori 100ml'}
  </div>

  ${generatedPlan.oilGuidelines ? `
  <div>
    <h4 style="font-size: 11px; color: #333; margin-bottom: 6px;">Use of Oils:</h4>
    <div class="oil-grid">
      <div class="oil-card">
        <h4>Cooking - Group A</h4>
        <ul style="list-style:none;padding:0;">${(generatedPlan.oilGuidelines.cooking?.groupA || []).map(o => `<li>- ${o}</li>`).join('')}</ul>
      </div>
      <div class="oil-card">
        <h4>Cooking - Group B</h4>
        <ul style="list-style:none;padding:0;">${(generatedPlan.oilGuidelines.cooking?.groupB || []).map(o => `<li>- ${o}</li>`).join('')}</ul>
      </div>
      <div class="oil-card">
        <h4>Raw/Topping</h4>
        <ul style="list-style:none;padding:0;">${(generatedPlan.oilGuidelines.raw || []).map(o => `<li>- ${o}</li>`).join('')}</ul>
      </div>
      <div class="oil-card">
        <h4>Deep Frying</h4>
        <ul style="list-style:none;padding:0;">${(generatedPlan.oilGuidelines.deepFrying || []).map(o => `<li>- ${o}</li>`).join('')}</ul>
      </div>
    </div>
    <p class="oil-note">${generatedPlan.oilGuidelines.note || ''}</p>
  </div>` : ''}

  ${generatedPlan.importantNotes?.length ? `
  <div class="important-notes">
    <h4>⚠️ Important Notes:</h4>
    <ul style="padding-left: 15px;">
      ${generatedPlan.importantNotes.map(n => `<li>${n}</li>`).join('')}
    </ul>
  </div>` : ''}

  ${generatedPlan.weeklyGroceryList?.length ? `
  <h3 class="section-title">🛒 Weekly Grocery List</h3>
  <div class="grocery-grid">
    ${generatedPlan.weeklyGroceryList.map(cat => `
      <div class="grocery-card">
        <h4>${cat.category}</h4>
        <ul>${cat.items.map(item => `<li>${item}</li>`).join('')}</ul>
      </div>
    `).join('')}
  </div>` : ''}

  <div class="tips-grid">
    <div class="tip-card">
      <h4>✨ Skin Care Tips</h4>
      <p>${generatedPlan.skinCareTips || ''}</p>
    </div>
    <div class="tip-card">
      <h4>💇 Hair Care Tips</h4>
      <p>${generatedPlan.hairCareTips || ''}</p>
    </div>
    <div class="tip-card">
      <h4>🏥 Health Notes</h4>
      <p>${generatedPlan.healthNotes || ''}</p>
    </div>
    <div class="tip-card">
      <h4>💊 Recommended Supplements</h4>
      <p>${generatedPlan.supplements || 'No supplements specified'}</p>
    </div>
  </div>

  ${generatedPlan.disclaimer ? `
  <div class="disclaimer">
    <strong>Disclaimer:</strong> ${generatedPlan.disclaimer}
  </div>` : ''}

  <div class="footer">
    © ${new Date().getFullYear()} Nutrition Hai Zaruri. This food plan is personalized and should be followed as advised.
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (!isOpen) {
    return (
      <Card className="p-6 mb-6 bg-gradient-to-r from-secondary to-accent border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-secondary-foreground">AI Diet Plan Generator</h3>
            <p className="text-sm text-muted-foreground">Generate personalized weekly food plans for clients using AI</p>
          </div>
          <Button onClick={() => setIsOpen(true)} className="gradient-primary text-primary-foreground">
            <Sparkles className="h-4 w-4 mr-2" />
            Generate AI Diet Plan
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      {/* Confirmation Dialog */}
      {showClearConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Clear Current Diet Plan?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              You have a generated diet plan that will be lost if you generate a new one. Do you want to continue?
            </p>
            <div className="flex gap-3 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowClearConfirmation(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  setShowClearConfirmation(false);
                  setGeneratedPlan(null);
                  setHasGeneratedPlan(false);
                  sessionStorage.removeItem(DIET_PLAN_STORAGE_KEY);
                  sessionStorage.removeItem(DIET_PLAN_CLIENT_KEY);
                  // Then proceed with generation
                  setTimeout(() => generatePlan(), 100);
                }}
              >
                Clear and Generate New
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reuse Diet Plan Dialog */}
      {showReuseOptions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Reuse Diet Plan from Another Client</h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Source Client *</Label>
                <Select value={reuseSourceClientId} onValueChange={handleReuseSourceClientChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a client to copy diet plan from" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {clients.filter(c => c.id !== selectedClientId).length === 0 ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground">No other clients available</div>
                    ) : (
                      clients.filter(c => c.id !== selectedClientId).map((client) => (
                        <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {loadingPlans && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading diet plans...
                </div>
              )}

              {!loadingPlans && availablePlans.length > 0 && (
                <div className="space-y-2">
                  <Label>Available Diet Plans</Label>
                  <div className="border rounded-lg max-h-60 overflow-y-auto">
                    {availablePlans.map((plan) => (
                      <div
                        key={plan.id}
                        className="p-3 border-b hover:bg-muted/50 cursor-pointer last:border-b-0"
                        onClick={() => loadPlanForReuse(plan)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-sm">{plan.plan_name}</h4>
                            <p className="text-xs text-muted-foreground">
                              Created: {new Date(plan.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button size="sm" variant="outline">
                            <Plus className="h-3 w-3 mr-1" />
                            Use This Plan
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!loadingPlans && reuseSourceClientId && availablePlans.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  No approved diet plans found for this client
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowReuseOptions(false);
                  setReuseSourceClientId('');
                  setAvailablePlans([]);
                  setSelectedReusePlan(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Template Selection Dialog */}
      {showTemplateOptions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Choose Diet Chart Template</h3>
            
            <div className="space-y-4">
              {loadingTemplates && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading templates...
                </div>
              )}

              {!loadingTemplates && templates.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  No diet chart templates found. Create templates first to use them here.
                </div>
              )}

              {!loadingTemplates && templates.length > 0 && (
                <div className="space-y-2">
                  <Label>Available Templates</Label>
                  <div className="border rounded-lg max-h-60 overflow-y-auto">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="p-3 border-b hover:bg-muted/50 cursor-pointer last:border-b-0"
                        onClick={() => useTemplate(template)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{template.name}</h4>
                            <p className="text-xs text-muted-foreground mb-1">
                              Category: {template.category}
                            </p>
                            {template.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {template.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {template.template_data.length} day(s) • Updated: {new Date(template.updated_at).toLocaleDateString()}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" className="ml-3">
                            <BookTemplate className="h-3 w-3 mr-1" />
                            Use Template
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowTemplateOptions(false);
                  setSelectedTemplate(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Day Sync Dialog */}
      {showDaySyncDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Sync Day Meal Plan</h3>
            
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Source Day</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {sourceDayIndex !== null && generatedPlan?.dayGroups[sourceDayIndex]?.label}
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
                    {generatedPlan?.dayGroups.map((day, idx) => (
                      idx !== sourceDayIndex && (
                        <SelectItem key={idx} value={idx.toString()}>
                          {day.label}
                        </SelectItem>
                      )
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-700">
                  {targetDayIndex === 'all' 
                    ? "This will copy the entire meal plan from this day to all other days, replacing their current meals."
                    : `This will copy the entire meal plan from this day to the selected day, replacing its current meals.`
                  }
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
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
                onClick={() => sourceDayIndex !== null && syncDayToAnother(sourceDayIndex, targetDayIndex)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Copy className="h-4 w-4 mr-2" />
                Sync Day
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card className="p-6 mb-6 border-primary/20">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-secondary-foreground">Generate AI Diet Plan</h3>
        <Button variant="ghost" onClick={() => {
          setIsOpen(false); 
          setGeneratedPlan(null);
          setHasGeneratedPlan(false);
          sessionStorage.removeItem(DIET_PLAN_STORAGE_KEY);
          sessionStorage.removeItem(DIET_PLAN_CLIENT_KEY);
          setSelectedClientId(''); 
          setSelectedClient(null); 
          setCustomPrompt(''); 
          setNumberOfDays('7');
        }}>
          Close
        </Button>
      </div>

      {isRestoring ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading...</span>
        </div>
      ) : !generatedPlan ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Client *</Label>
              <Select value={selectedClientId} onValueChange={handleClientSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a client" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {clients.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">No clients yet. Add clients first.</div>
                  ) : (
                    clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Number of Days *</Label>
              <Select value={numberOfDays} onValueChange={setNumberOfDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {[1, 2, 3, 4, 5, 6, 7].map(d => (
                    <SelectItem key={d} value={d.toString()}>
                      {d} {d === 1 ? 'Day' : 'Days'} {d === 7 ? '(Full Week)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {parseInt(numberOfDays) >= 4 ? 'Days will be paired: Mon-Thu, Tue-Fri, Wed-Sat' : 'Each day will have unique meals'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Start Date *</Label>
              <Popover open={showStartCalendar} onOpenChange={setShowStartCalendar}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      setShowStartCalendar(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                📅 The diet chart will start from this date and show actual weekdays (e.g., if you select Friday, the plan will start from Friday)
              </p>
            </div>
          </div>

          {selectedClient && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Client Profile</h4>
                <Badge variant="outline" className="text-primary border-primary">
                  Next: Diet Chart {nextDietChartNumber}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground">Height:</span> <span className="font-medium">{selectedClient.height ? `${selectedClient.height} cm` : <span className="text-destructive">Not set</span>}</span></div>
                <div><span className="text-muted-foreground">Weight:</span> <span className="font-medium">{selectedClient.weight ? `${selectedClient.weight} kg` : <span className="text-destructive">Not set</span>}</span></div>
                <div><span className="text-muted-foreground">Gender:</span> <span className="font-medium capitalize">{selectedClient.gender || <span className="text-destructive">Not set</span>}</span></div>
                <div><span className="text-muted-foreground">Goal:</span> <span className="font-medium capitalize">{selectedClient.goal?.replace('_', ' ') || <span className="text-destructive">Not set</span>}</span></div>
                <div><span className="text-muted-foreground">Skin:</span> <span className="font-medium">{selectedClient.skin_type || 'Normal'}</span></div>
                <div><span className="text-muted-foreground">Hair:</span> <span className="font-medium">{selectedClient.hair_type || 'Normal'}</span></div>
                <div><span className="text-muted-foreground">Diet:</span> <span className="font-medium capitalize">{selectedClient.diet_preference || 'Not set'}</span></div>
                <div><span className="text-muted-foreground">Age:</span> <span className="font-medium">{calculateAge(selectedClient.date_of_birth)} years</span></div>
              </div>
              {selectedClient.health_conditions && selectedClient.health_conditions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Health Conditions:</span>
                  {selectedClient.health_conditions.map((condition) => (
                    <Badge key={condition} variant="outline">{condition}</Badge>
                  ))}
                </div>
              )}
              {(!selectedClient.height || !selectedClient.weight || !selectedClient.gender || !selectedClient.goal) && (
                <p className="text-sm text-destructive">⚠️ Please update the client's profile with missing required fields (height, weight, gender, goal) before generating a diet plan.</p>
              )}
            </div>
          )}

          {/* Supplements Section */}
          <div className="space-y-2">
            <Label>Supplements (Optional)</Label>
            <Textarea
              value={supplements}
              onChange={(e) => setSupplements(e.target.value)}
              placeholder="Enter supplements for this client (e.g., Vitamin D 1000 IU daily, Omega-3 1000mg twice daily, Probiotics 1 capsule daily)"
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {selectedClient?.supplements ? 
                "Supplements from client profile are loaded above. You can modify them as needed." :
                "Add any recommended supplements with dosage instructions. These will be included in the diet plan."
              }
            </p>
          </div>

          {/* Enhanced Custom Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">📝 Detailed Nutritionist Instructions</Label>
              <span className="text-xs text-muted-foreground">
                {customPrompt.length}/2000 characters
              </span>
            </div>
            <Textarea
              value={customPrompt}
              onChange={(e) => {
                if (e.target.value.length <= 2000) {
                  setCustomPrompt(e.target.value);
                }
              }}
              placeholder="Provide detailed instructions for the diet plan. Examples:
• Client prefers South Indian cuisine, especially Kerala and Tamil Nadu dishes
• No wheat, rice, or refined sugar - use millets, quinoa, and natural sweeteners
• High protein requirement (80g+ daily) for muscle building
• Avoid nightshade vegetables (tomatoes, potatoes, eggplant, peppers)
• Include traditional superfoods: ashwagandha, moringa, amla, triphala
• Focus on anti-inflammatory foods for joint health
• Client works night shifts - meal timing should accommodate schedule
• Prefer quick meals (<20 min prep) for busy lifestyle
• Include post-workout nutrition guidance
• Emphasize gut healing foods and probiotics
• Client travels frequently - include portable meal options
• Food allergies: nuts, soy, shellfish
• Religious dietary requirements: Jain vegetarian (no root vegetables)
• Budget-conscious meal planning using local seasonal ingredients
• Prefer traditional cooking methods over processed foods
• Include meal prep suggestions for batch cooking on weekends"
              rows={8}
              className="resize-none text-sm"
              maxLength={2000}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                🎯 <strong>Highest Priority:</strong> These instructions will be followed precisely after dietary restrictions
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCustomPrompt("");
                }}
                className="text-xs"
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Quick Dietary Restriction Templates */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">⚡ Quick Restriction Templates</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const wheatFree = "ABSOLUTELY NO wheat products including wheat flour, maida, sooji, rava, semolina. Use creative alternatives: ragi, jowar, bajra, quinoa, brown rice, oats, buckwheat, amaranth. All breads, rotis, parathas must be made from alternative flours.";
                  setCustomPrompt(prev => prev ? `${prev}\n\n${wheatFree}` : wheatFree);
                }}
                className="text-xs"
              >
                🌾 No Wheat
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const dairyFree = "ABSOLUTELY NO dairy products including milk, curd, paneer, ghee, cheese, butter, cream. Use alternatives: almond milk, coconut milk, soy milk, oat milk, tofu, nut-based curd, plant-based ghee, vegan cheese.";
                  setCustomPrompt(prev => prev ? `${prev}\n\n${dairyFree}` : dairyFree);
                }}
                className="text-xs"
              >
                🥛 No Dairy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const vegan = "STRICTLY VEGAN - No animal products including meat, poultry, fish, eggs, dairy, honey, gelatin. Use plant-based protein sources: lentils, beans, chickpeas, tofu, tempeh, seitan, nuts, seeds.";
                  setCustomPrompt(prev => prev ? `${prev}\n\n${vegan}` : vegan);
                }}
                className="text-xs"
              >
                🌱 Vegan
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const glutenFree = "ABSOLUTELY NO gluten including wheat, barley, rye, oats (unless certified gluten-free), bulgur, couscous. Use gluten-free alternatives: rice, quinoa, millets, buckwheat, corn, certified gluten-free oats.";
                  setCustomPrompt(prev => prev ? `${prev}\n\n${glutenFree}` : glutenFree);
                }}
                className="text-xs"
              >
                🌾 Gluten-Free
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const noSugar = "ABSOLUTELY NO added sugars including white sugar, brown sugar, jaggery, honey, maple syrup, agave, high-fructose corn syrup. Use natural sweeteners: stevia, monk fruit, erythritol, or whole fruits for sweetness.";
                  setCustomPrompt(prev => prev ? `${prev}\n\n${noSugar}` : noSugar);
                }}
                className="text-xs"
              >
                🍯 No Sugar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const jain = "JAIN DIETARY REQUIREMENTS - No root vegetables including potatoes, onions, garlic, carrots, beets, radishes, ginger, turmeric. No meat, eggs, or alcohol. Use above-ground vegetables and Jain-friendly spices.";
                  setCustomPrompt(prev => prev ? `${prev}\n\n${jain}` : jain);
                }}
                className="text-xs"
              >
              🕉️ Jain
              </Button>
            </div>
          </div>

          {/* Reuse Diet Plan Option */}
          <div className="space-y-2">
            <Button
              onClick={() => setShowReuseOptions(true)}
              disabled={!selectedClientId}
              variant="outline"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Reuse Diet Plan from Another Client
            </Button>
          </div>

          {/* Use Template Option */}
          <div className="space-y-2">
            <Button
              onClick={() => setShowTemplateOptions(true)}
              disabled={!selectedClientId}
              variant="outline"
              className="w-full"
            >
              <BookTemplate className="h-4 w-4 mr-2" />
              Use Diet Chart Template
            </Button>
          </div>

          <Button
            onClick={generatePlan}
            disabled={isGenerating || !selectedClientId || !selectedClient?.height || !selectedClient?.weight || !selectedClient?.gender || !selectedClient?.goal}
            className="w-full gradient-primary text-primary-foreground"
          >
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating {numberOfDays}-Day Plan...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" />Generate {numberOfDays}-Day Food Plan</>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Editable Plan Name & Intro */}
          <div className="p-4 bg-secondary border border-primary/20 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              {editingField === 'planName' ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input value={editFieldValue} onChange={e => setEditFieldValue(e.target.value)} className="text-sm" />
                  <Button size="icon" variant="ghost" onClick={saveEditField}><Check className="h-4 w-4 text-green-600" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingField(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <h4 className="font-semibold text-secondary-foreground cursor-pointer hover:text-primary" onClick={() => startEditField('planName', generatedPlan.planName)}>
                  {generatedPlan.planName} <Pencil className="h-3 w-3 inline ml-1 text-muted-foreground" />
                </h4>
              )}
              <div className="flex items-center gap-2">
                {isEditMode && (
                  <>
                    {editSource === 'draft' && (
                      <Badge variant="outline" className="border-blue-500 text-blue-600">
                        Editing Draft
                      </Badge>
                    )}
                    {editSource === 'reuse' && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-green-500 text-green-600">
                          Reusing Plan
                        </Badge>
                        {selectedReusePlan && (
                          <Badge variant="secondary" className="text-xs">
                            From: {clients.find(c => c.id === selectedReusePlan.client_id)?.name || 'Unknown Client'}
                          </Badge>
                        )}
                      </div>
                    )}
                  </>
                )}
                <Badge className="bg-primary text-primary-foreground">{getFullPlanName()}</Badge>
              </div>
            </div>
            {editingField === 'introMessage' ? (
              <div className="flex items-start gap-2">
                <Textarea value={editFieldValue} onChange={e => setEditFieldValue(e.target.value)} rows={2} className="text-sm" />
                <div className="flex flex-col gap-1">
                  <Button size="icon" variant="ghost" onClick={saveEditField}><Check className="h-4 w-4 text-green-600" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingField(null)}><X className="h-4 w-4" /></Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => startEditField('introMessage', generatedPlan.introMessage)}>
                {generatedPlan.introMessage} <Pencil className="h-3 w-3 inline ml-1" />
              </p>
            )}
          </div>

          {/* Client KYC Details */}
          {selectedClient && (
            <>
              {console.log('Rendering client details for:', selectedClient.name)}
              <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                <h4 className="font-semibold text-blue-700 dark:text-blue-300 text-sm mb-3">📋 Client Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Name:</span>
                  <p className="text-gray-900">{selectedClient.name}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Age:</span>
                  <p className="text-gray-900">{calculateAge(selectedClient.date_of_birth)} years</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Gender:</span>
                  <p className="text-gray-900">{selectedClient.gender || 'Not specified'}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Height/Weight:</span>
                  <p className="text-gray-900">{selectedClient.height || '--'}cm / {selectedClient.weight || '--'}kg</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Skin Type:</span>
                  <p className="text-gray-900">{selectedClient.skin_type || 'Not specified'}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Hair Type:</span>
                  <p className="text-gray-900">{selectedClient.hair_type || 'Not specified'}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Goal:</span>
                  <p className="text-gray-900">{selectedClient.goal || 'Not specified'}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Diet Preference:</span>
                  <p className="text-gray-900">{selectedClient.diet_preference || 'Not specified'}</p>
                </div>
              </div>
              {selectedClient.health_conditions && selectedClient.health_conditions.length > 0 && (
                <div className="mt-3">
                  <span className="font-medium text-gray-600">Health Conditions:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedClient.health_conditions.map((condition, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {condition}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {selectedClient.notes && (
                <div className="mt-3">
                  <span className="font-medium text-gray-600">Notes:</span>
                  <p className="text-gray-900 text-sm mt-1">{selectedClient.notes}</p>
                </div>
              )}
            </Card>
            </>
          )}

          {/* Day Group Tables - Editable */}
          {hasGeneratedPlan && generatedPlan.dayGroups.map((group, groupIdx) => (
            <div key={groupIdx}>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="font-semibold text-primary text-sm">📅 {group.label}</h4>
                {group.dates && (
                  <span className="text-muted-foreground text-xs">({group.dates})</span>
                )}
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    const newLabel = prompt('Edit day group label:', group.label);
                    if (newLabel && newLabel !== group.label) {
                      const updated = { ...generatedPlan };
                      updated.dayGroups = updated.dayGroups.map((g, i) => 
                        i === groupIdx ? { ...g, label: newLabel } : g
                      );
                      setGeneratedPlan(updated);
                    }
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-6 px-2 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                  onClick={() => {
                    setSourceDayIndex(groupIdx);
                    setShowDaySyncDialog(true);
                  }}
                  title="Sync this day's meal plan to other days"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                {group.dates && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      const newDates = prompt('Edit dates:', group.dates);
                      if (newDates && newDates !== group.dates) {
                        const updated = { ...generatedPlan };
                        updated.dayGroups = updated.dayGroups.map((g, i) => 
                          i === groupIdx ? { ...g, dates: newDates } : g
                        );
                        setGeneratedPlan(updated);
                      }
                    }}
                  >
                    <CalendarIcon className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                   <tr className="bg-warning text-warning-foreground">
                      <th className="text-left p-2 font-semibold text-xs w-[13%]">Period</th>
                      <th className="text-left p-2 font-semibold text-xs w-[8%]">Time</th>
                      <th className="text-left p-2 font-semibold text-xs w-[32%]">Food Plan</th>
                      <th className="text-left p-2 font-semibold text-xs w-[28%]">Alternative</th>
                      <th className="text-left p-2 font-semibold text-xs w-[14%]">Notes</th>
                      <th className="text-left p-2 font-semibold text-xs w-[5%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.meals.map((meal, mealIdx) => (
                      <React.Fragment key={mealIdx}>
                        <tr className={mealIdx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
                          <td className="p-2 font-medium text-foreground text-xs">
                            {editingCell?.groupIdx === groupIdx && editingCell?.mealIdx === mealIdx && editingCell?.field === 'period' ? (
                              <div className="flex items-center gap-1 min-w-[80px]">
                                <Input 
                                  value={editValue} 
                                  onChange={e => setEditValue(e.target.value)} 
                                  className="text-xs h-7 px-2 py-1 min-w-[70px] border-2 border-primary" 
                                  autoFocus
                                />
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={saveEditCell}><Check className="h-3 w-3 text-green-600" /></Button>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setEditingCell(null)}><X className="h-3 w-3" /></Button>
                                </div>
                              </div>
                            ) : (
                              <span 
                                className="cursor-pointer hover:text-primary hover:bg-muted/30 px-1 py-0.5 rounded transition-colors" 
                                onClick={() => startEditCell(groupIdx, mealIdx, 'period')}
                              >
                                {meal.period} <Pencil className="h-2.5 w-2.5 inline ml-0.5 text-muted-foreground" />
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-muted-foreground whitespace-nowrap text-xs">
                            {editingCell?.groupIdx === groupIdx && editingCell?.mealIdx === mealIdx && editingCell?.field === 'time' ? (
                              <div className="flex items-center gap-1 min-w-[80px]">
                                <Input 
                                  value={editValue} 
                                  onChange={e => setEditValue(e.target.value)} 
                                  className="text-xs h-7 px-2 py-1 min-w-[60px] border-2 border-primary" 
                                  autoFocus
                                />
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={saveEditCell}><Check className="h-3 w-3 text-green-600" /></Button>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setEditingCell(null)}><X className="h-3 w-3" /></Button>
                                </div>
                              </div>
                            ) : (
                              <span 
                                className="cursor-pointer hover:text-primary hover:bg-muted/30 px-1 py-0.5 rounded transition-colors" 
                                onClick={() => startEditCell(groupIdx, mealIdx, 'time')}
                              >
                                {meal.time} <Pencil className="h-2.5 w-2.5 inline ml-0.5 text-muted-foreground" />
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-xs">
                            {editingCell?.groupIdx === groupIdx && editingCell?.mealIdx === mealIdx && editingCell?.field === 'foodPlan' ? (
                              <div className="flex items-start gap-1">
                                <Textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={2} className="text-xs min-h-0" />
                                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={saveEditCell}><Check className="h-3 w-3 text-green-600" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setEditingCell(null)}><X className="h-3 w-3" /></Button>
                              </div>
                            ) : (
                              <span className="cursor-pointer hover:text-primary whitespace-pre-line" onClick={() => startEditCell(groupIdx, mealIdx, 'foodPlan')}>
                                {meal.foodPlan} <Pencil className="h-2.5 w-2.5 inline ml-0.5 text-muted-foreground" />
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-xs text-muted-foreground italic">
                            {editingCell?.groupIdx === groupIdx && editingCell?.mealIdx === mealIdx && editingCell?.field === 'alternative' ? (
                              <div className="flex items-start gap-1">
                                <Textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={2} className="text-xs min-h-0" />
                                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={saveEditCell}><Check className="h-3 w-3 text-green-600" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setEditingCell(null)}><X className="h-3 w-3" /></Button>
                              </div>
                            ) : (
                              <span className="cursor-pointer hover:text-foreground whitespace-pre-line" onClick={() => startEditCell(groupIdx, mealIdx, 'alternative')}>
                                {meal.alternative || '-'} <Pencil className="h-2.5 w-2.5 inline ml-0.5" />
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-muted-foreground text-xs">
                            {editingCell?.groupIdx === groupIdx && editingCell?.mealIdx === mealIdx && editingCell?.field === 'notes' ? (
                              <div className="flex items-start gap-1">
                                <Textarea value={editValue} onChange={e => setEditValue(e.target.value)} rows={2} className="text-xs min-h-0" />
                                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={saveEditCell}><Check className="h-3 w-3 text-green-600" /></Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setEditingCell(null)}><X className="h-3 w-3" /></Button>
                              </div>
                            ) : (
                              <span className="cursor-pointer hover:text-foreground whitespace-pre-line" onClick={() => startEditCell(groupIdx, mealIdx, 'notes')}>
                                {meal.notes || '-'} <Pencil className="h-2.5 w-2.5 inline ml-0.5" />
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                onClick={() => addMealRow(groupIdx, mealIdx + 1)}
                                title="Add meal after this row"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeMealRow(groupIdx, mealIdx)}
                                title="Remove meal"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                                onClick={() => syncMealAcrossGroups(groupIdx, mealIdx)}
                                title="Sync this meal to all day groups"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {/* Add meal row between existing meals */}
                        <tr className="bg-primary/5">
                          <td colSpan={6} className="p-1 text-center">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="text-xs text-primary hover:bg-primary/10 h-6 px-2"
                              onClick={() => addMealRow(groupIdx, mealIdx + 1)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Meal Here
                            </Button>
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex justify-center">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs border-primary/20 text-primary hover:bg-primary/10"
                  onClick={() => addMealRow(groupIdx)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Meal
                </Button>
              </div>
            </div>
          ))}

          {/* Weekly Grocery List */}
          {generatedPlan.weeklyGroceryList?.length > 0 && (
            <div>
              <h4 className="font-semibold text-primary text-sm mb-2">🛒 Weekly Grocery List</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {generatedPlan.weeklyGroceryList.map((cat, catIdx) => (
                  <Card key={catIdx} className="p-3 bg-green-50 dark:bg-green-950/20 border-green-200">
                    <div className="mb-2">
                      {editingGroceryCategory?.catIdx === catIdx && editingGroceryCategory?.field === 'category' ? (
                        <div className="flex items-center gap-1">
                          <Input value={groceryEditValue} onChange={e => setGroceryEditValue(e.target.value)} className="text-sm h-7" />
                          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={saveEditGroceryCategory}><Check className="h-3 w-3 text-green-600" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setEditingGroceryCategory(null)}><X className="h-3 w-3" /></Button>
                        </div>
                      ) : (
                        <h5 
                          className="font-semibold text-sm text-green-800 dark:text-green-300 cursor-pointer hover:text-green-600" 
                          onClick={() => startEditGroceryCategory(catIdx, 'category', cat.category)}
                        >
                          {cat.category} <Pencil className="h-2.5 w-2.5 inline ml-1" />
                        </h5>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {editingGroceryCategory?.catIdx === catIdx && editingGroceryCategory?.field === 'items' ? (
                        <div className="space-y-1">
                          <Textarea 
                            value={groceryEditValue} 
                            onChange={e => setGroceryEditValue(e.target.value)} 
                            rows={Math.max(3, cat.items.length)} 
                            className="text-xs min-h-0" 
                            placeholder="Enter items (one per line)"
                          />
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={saveEditGroceryCategory}><Check className="h-3 w-3 text-green-600" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingGroceryCategory(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      ) : (
                        <ul className="space-y-0.5">
                          {cat.items.map((item, i) => (
                            <li key={i}>• {item}</li>
                          ))}
                        </ul>
                      )}
                      {editingGroceryCategory?.catIdx !== catIdx && (
                        <button
                          className="text-xs text-green-600 hover:text-green-700 mt-1 cursor-pointer"
                          onClick={() => startEditGroceryCategory(catIdx, 'items', cat.items.join('\n'))}
                        >
                          <Pencil className="h-2.5 w-2.5 inline mr-1" />Edit Items
                        </button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Important Notes */}
          {generatedPlan.importantNotes?.length > 0 && (
            <div>
              <h4 className="font-semibold text-primary text-sm mb-2">⚠️ Important Notes</h4>
              <Card className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200">
                {editingImportantNotes ? (
                  <div className="space-y-2">
                    <Textarea 
                      value={importantNotesValue} 
                      onChange={e => setImportantNotesValue(e.target.value)} 
                      rows={4} 
                      className="text-sm" 
                      placeholder="Enter important notes (one per line)"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveImportantNotes}>
                        <Check className="h-3 w-3 mr-1" />Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingImportantNotes(false)}>
                        <X className="h-3 w-3 mr-1" />Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <ul className="text-sm space-y-1 mb-2">
                      {generatedPlan.importantNotes.map((note, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-yellow-600 mr-2">•</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                    <button 
                      className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                      onClick={startEditImportantNotes}
                    >
                      <Pencil className="h-2.5 w-2.5" />Edit Notes
                    </button>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Tips */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 bg-secondary">
              <h5 className="font-semibold text-secondary-foreground text-sm">✨ Skin Care</h5>
              {editingField === 'skinCareTips' ? (
                <div className="flex items-start gap-1 mt-1">
                  <Textarea value={editFieldValue} onChange={e => setEditFieldValue(e.target.value)} rows={2} className="text-xs" />
                  <Button size="icon" variant="ghost" onClick={saveEditField}><Check className="h-3 w-3 text-green-600" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingField(null)}><X className="h-3 w-3" /></Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1 cursor-pointer hover:text-foreground" onClick={() => startEditField('skinCareTips', generatedPlan.skinCareTips)}>
                  {generatedPlan.skinCareTips} <Pencil className="h-2.5 w-2.5 inline ml-0.5" />
                </p>
              )}
            </Card>
            <Card className="p-4 bg-secondary">
              <h5 className="font-semibold text-secondary-foreground text-sm">💇 Hair Care</h5>
              {editingField === 'hairCareTips' ? (
                <div className="flex items-start gap-1 mt-1">
                  <Textarea value={editFieldValue} onChange={e => setEditFieldValue(e.target.value)} rows={2} className="text-xs" />
                  <Button size="icon" variant="ghost" onClick={saveEditField}><Check className="h-3 w-3 text-green-600" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingField(null)}><X className="h-3 w-3" /></Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1 cursor-pointer hover:text-foreground" onClick={() => startEditField('hairCareTips', generatedPlan.hairCareTips)}>
                  {generatedPlan.hairCareTips} <Pencil className="h-2.5 w-2.5 inline ml-0.5" />
                </p>
              )}
            </Card>
            <Card className="p-4 bg-secondary">
              <h5 className="font-semibold text-secondary-foreground text-sm">🏥 Health Notes</h5>
              {editingField === 'healthNotes' ? (
                <div className="flex items-start gap-1 mt-1">
                  <Textarea value={editFieldValue} onChange={e => setEditFieldValue(e.target.value)} rows={2} className="text-xs" />
                  <Button size="icon" variant="ghost" onClick={saveEditField}><Check className="h-3 w-3 text-green-600" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingField(null)}><X className="h-3 w-3" /></Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1 cursor-pointer hover:text-foreground" onClick={() => startEditField('healthNotes', generatedPlan.healthNotes)}>
                  {generatedPlan.healthNotes} <Pencil className="h-2.5 w-2.5 inline ml-0.5" />
                </p>
              )}
            </Card>
            <Card className="p-4 bg-secondary">
              <h5 className="font-semibold text-secondary-foreground text-sm">💊 Supplements</h5>
              {editingField === 'supplements' ? (
                <div className="flex items-start gap-1 mt-1">
                  <Textarea value={editFieldValue} onChange={e => setEditFieldValue(e.target.value)} rows={2} className="text-xs" />
                  <Button size="icon" variant="ghost" onClick={saveEditField}><Check className="h-3 w-3 text-green-600" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingField(null)}><X className="h-3 w-3" /></Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-1 cursor-pointer hover:text-foreground" onClick={() => startEditField('supplements', generatedPlan.supplements || 'No supplements specified')}>
                  {generatedPlan.supplements || 'No supplements specified'} <Pencil className="h-2.5 w-2.5 inline ml-0.5" />
                </p>
              )}
            </Card>
          </div>

          <p className="text-xs text-muted-foreground">💡 Click on any text with a ✏️ icon to edit it before downloading.</p>

          {/* Custom Title Input */}
          <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-blue-800 dark:text-blue-300">
                📝 Custom Title (Optional)
              </Label>
              <Input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Add a custom title to easily find this plan (e.g., 'Weight Loss Focus', 'Muscle Gain Plan')"
                className="text-sm"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                This will be added to the diet chart name: {getFullPlanName()}
              </p>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div className="flex gap-2">
              {isEditMode ? (
                <>
                  {editSource === 'draft' ? (
                    <>
                      <Button onClick={updateEditedPlan} variant="outline">
                        <Save className="h-4 w-4 mr-2" />
                        Save Draft
                      </Button>
                      <Button onClick={approveDraft} className="gradient-primary text-primary-foreground">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve as {getFullPlanName()}
                      </Button>
                    </>
                  ) : editSource === 'reuse' ? (
                    <>
                      <Button onClick={saveReusedPlan} className="gradient-primary text-primary-foreground">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Save as {getFullPlanName()}
                      </Button>
                    </>
                  ) : editSource === 'template' ? (
                    <>
                      <Button onClick={saveReusedPlan} className="gradient-primary text-primary-foreground">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Save as {getFullPlanName()}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={approvePlan} disabled={isApproving} className="gradient-primary text-primary-foreground">
                      {isApproving ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Approving...</>
                      ) : (
                        <><CheckCircle2 className="h-4 w-4 mr-2" />Approve & Save as {getFullPlanName()}</>
                      )}
                    </Button>
                  )}
                  <Button variant="outline" onClick={cancelEdit}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </>
              ) : (
                <Button onClick={approvePlan} disabled={isApproving} className="gradient-primary text-primary-foreground">
                  {isApproving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Approving...</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4 mr-2" />Approve & Save as {getFullPlanName()}</>
                  )}
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button onClick={generatePDF} className="gradient-primary text-primary-foreground">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              
              {!isEditMode && editSource !== 'draft' && editSource !== 'reuse' && (
                <>
                  <Button variant="outline" onClick={() => setShowDraftOptions(!showDraftOptions)}>
                    <Save className="h-4 w-4 mr-2" />
                    Save as Draft
                  </Button>
                  
                  {showDraftOptions && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-10">
                      <div className="p-2">
                        <Button 
                          size="sm" 
                          onClick={saveAsDraft}
                          className="w-full justify-start"
                        >
                          <Save className="h-3 w-3 mr-2" />
                          Save as Draft
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              <Button variant="outline" onClick={() => { 
                setGeneratedPlan(null);
                setHasGeneratedPlan(false);
                sessionStorage.removeItem(DIET_PLAN_STORAGE_KEY);
                sessionStorage.removeItem(DIET_PLAN_CLIENT_KEY);
              }}>
                Generate New Plan
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  </>
  );
};

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Download, Loader2, Pencil, Check, X, CheckCircle2, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Client } from '@/hooks/useClients';

interface MealItem {
  period: string;
  time: string;
  foodPlan: string;
  alternative: string;
  notes: string;
}

interface DayGroup {
  label: string;
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
  weeklyGroceryList: GroceryCategory[];
}

interface Props {
  clients: Client[];
  editModeData?: { id: string; data: DietPlan & { clientId?: string }; source: 'draft' | 'reuse'; clientId?: string } | null;
  onClose?: () => void;
}

export const AIDietPlanGenerator = ({ clients, editModeData, onClose }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<DietPlan | null>(null);
  const [hasGeneratedPlan, setHasGeneratedPlan] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [numberOfDays, setNumberOfDays] = useState('7');
  const [nextWeekNumber, setNextWeekNumber] = useState(1);
  const [editingCell, setEditingCell] = useState<{ groupIdx: number; mealIdx: number; field: 'foodPlan' | 'notes' | 'alternative' | 'period' | 'time' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editFieldValue, setEditFieldValue] = useState('');
  const [editingGroceryCategory, setEditingGroceryCategory] = useState<{ catIdx: number; field: 'category' | 'items' } | null>(null);
  const [groceryEditValue, setGroceryEditValue] = useState('');
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [editingImportantNotes, setEditingImportantNotes] = useState(false);
  const [importantNotesValue, setImportantNotesValue] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [showDraftOptions, setShowDraftOptions] = useState(false);
  const [editSource, setEditSource] = useState<'draft' | 'reuse' | 'new' | null>(null);
  const [originalPlanData, setOriginalPlanData] = useState<DietPlan | null>(null);

  // Session storage key for diet plan
  const DIET_PLAN_STORAGE_KEY = 'ai_diet_plan_generator_plan';

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

  // Restore plan from session storage on mount
  useEffect(() => {
    const savedPlan = sessionStorage.getItem(DIET_PLAN_STORAGE_KEY);
    if (savedPlan) {
      try {
        const plan = JSON.parse(savedPlan);
        setGeneratedPlan(plan);
        setHasGeneratedPlan(true);
      } catch (error) {
        console.error('Error parsing saved plan:', error);
        sessionStorage.removeItem(DIET_PLAN_STORAGE_KEY);
      }
    }
  }, []);

  // Save to session storage when plan changes
  useEffect(() => {
    if (generatedPlan) {
      sessionStorage.setItem(DIET_PLAN_STORAGE_KEY, JSON.stringify(generatedPlan));
    } else if (!generatedPlan && hasGeneratedPlan) {
      // Plan was cleared, remove from storage
      sessionStorage.removeItem(DIET_PLAN_STORAGE_KEY);
    }
  }, [generatedPlan, hasGeneratedPlan]);

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
      
      const notesText = client.notes ? `Notes: ${client.notes}` : '';
      
      const autoGeneratedText = [healthConditionsText, notesText]
        .filter(Boolean)
        .join('\n');
      
      // Only set auto-generated text if current prompt is empty or only contains auto-generated content
      if (!customPrompt.trim() || customPrompt.trim() === autoGeneratedText) {
        setCustomPrompt(autoGeneratedText);
      }
    } else {
      setCustomPrompt('');
    }
    
    // Fetch the latest approved week number for this client
    const { data, error } = await supabase
      .from('diet_plans')
      .select('week_number')
      .eq('client_id', clientId)
      .eq('is_ai_generated', true)
      .eq('status', 'approved')
      .order('week_number', { ascending: false })
      .limit(1);
    
    if (!error && data && data.length > 0) {
      setNextWeekNumber((data[0].week_number || 0) + 1);
    } else {
      setNextWeekNumber(1);
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
      skinType: selectedClient.skin_type || 'Normal',
      hairType: selectedClient.hair_type || 'Normal',
      healthConditions: selectedClient.health_conditions || [],
      dietPreference: (selectedClient.diet_preference === 'non-vegetarian' ? 'non-vegetarian' :
        selectedClient.diet_preference === 'vegetarian' ? 'vegetarian' : 'both') as 'vegetarian' | 'non-vegetarian' | 'both',
      notes: selectedClient.notes || '',
    };
  };

  const generatePlan = async () => {
    const clientDetails = getClientDetails();
    if (!clientDetails) return;
    
    // Show confirmation if there's already a generated plan
    if (generatedPlan) {
      setShowClearConfirmation(true);
      return;
    }
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-diet-plan', {
        body: { clientDetails, customPrompt: customPrompt.trim() || undefined, numberOfDays: parseInt(numberOfDays) },
      });
      if (error) throw error;
      if (!data?.dietPlan) throw new Error('No plan Generated');
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

  const approvePlan = async () => {
    if (!generatedPlan || !selectedClientId) return;
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('diet_plans')
        .insert({
          client_id: selectedClientId,
          plan_name: `${generatedPlan.planName} - Week ${nextWeekNumber}`,
          instructions: generatedPlan.introMessage,
          status: 'approved',
          is_ai_generated: true,
          week_number: nextWeekNumber,
          ai_plan_data: generatedPlan as any,
        });

      if (error) throw error;
      toast.success(`Plan approved & saved as Week ${nextWeekNumber}!`);
      setNextWeekNumber(prev => prev + 1);
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
  const addMealRow = (groupIdx: number) => {
    if (!generatedPlan) return;
    const updated = { ...generatedPlan };
    const newMeal: MealItem = {
      period: 'New Meal',
      time: '12:00 PM',
      foodPlan: 'Click to add food plan',
      alternative: '',
      notes: ''
    };
    
    updated.dayGroups = updated.dayGroups.map((g, gi) =>
      gi === groupIdx ? { ...g, meals: [...g.meals, newMeal] } : g
    );
    
    setGeneratedPlan(updated);
  };

  const removeMealRow = (groupIdx: number, mealIdx: number) => {
    if (!generatedPlan) return;
    const updated = { ...generatedPlan };
    
    updated.dayGroups = updated.dayGroups.map((g, gi) =>
      gi === groupIdx 
        ? { ...g, meals: g.meals.filter((_, mi) => mi !== mealIdx) }
        : g
    );
    
    setGeneratedPlan(updated);
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

  // Save plan as draft
  const saveAsDraft = async () => {
    if (!generatedPlan || !selectedClient) return;
    
    try {
      const { error } = await supabase
        .from('diet_plans')
        .insert({
          client_id: selectedClient.id,
          week_number: nextWeekNumber,
          plan_name: generatedPlan.planName,
          ai_plan_data: generatedPlan as any, // Cast to any for Json compatibility
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
          ai_plan_data: generatedPlan as any,
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingPlanId);
      
      if (error) throw error;
      
      toast.success('Draft approved and saved successfully!');
      resetEditMode();
    } catch (error: any) {
      console.error('Error approving draft:', error);
      toast.error('Failed to approve draft');
    }
  };

  // Save reused plan as new approved plan
  const saveReusedPlan = async () => {
    console.log('saveReusedPlan called', { generatedPlan, selectedClient, nextWeekNumber });
    if (!generatedPlan || !selectedClient) {
      toast.error('Missing required data for saving');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('diet_plans')
        .insert({
          client_id: selectedClient.id,
          week_number: nextWeekNumber,
          plan_name: generatedPlan.planName,
          ai_plan_data: generatedPlan as any,
          status: 'approved',
          is_ai_generated: true,
          created_at: new Date().toISOString(),
        });
      
      if (error) throw error;
      
      toast.success('Reused plan saved and approved successfully!');
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
      <h3 style="font-size: 14px; color: #5a7a32; font-weight: 700; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #d4e4bc;">📅 ${group.label}</h3>
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
      <span class="week-badge">Week ${nextWeekNumber}</span>
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

      <Card className="p-6 mb-6 border-primary/20">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-secondary-foreground">Generate AI Diet Plan</h3>
        <Button variant="ghost" onClick={() => {
          setIsOpen(false); 
          setGeneratedPlan(null);
          setHasGeneratedPlan(false);
          sessionStorage.removeItem(DIET_PLAN_STORAGE_KEY);
          setSelectedClientId(''); 
          setSelectedClient(null); 
          setCustomPrompt(''); 
          setNumberOfDays('7');
        }}>
          Close
        </Button>
      </div>

      {!generatedPlan ? (
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
          </div>

          {selectedClient && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Client Profile</h4>
                <Badge variant="outline" className="text-primary border-primary">
                  Next: Week {nextWeekNumber}
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

          {/* Custom Prompt */}
          <div className="space-y-2">
            <Label>Additional Instructions (Optional)</Label>
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g., Client prefers South Indian food, has lactose intolerance, needs high protein meals, avoid gluten, include more millets..."
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">Add specific dietary preferences, restrictions, or any other details to customize the plan further.</p>
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
                      <Badge variant="outline" className="border-green-500 text-green-600">
                        Reusing Plan
                      </Badge>
                    )}
                  </>
                )}
                <Badge className="bg-primary text-primary-foreground">Week {nextWeekNumber}</Badge>
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
          {generatedPlan.dayGroups.map((group, groupIdx) => (
            <div key={groupIdx}>
              <h4 className="font-semibold text-primary text-sm mb-2">📅 {group.label}</h4>
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
                      <tr key={mealIdx} className={mealIdx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}>
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
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeMealRow(groupIdx, mealIdx)}
                            title="Remove meal"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          </div>

          <p className="text-xs text-muted-foreground">💡 Click on any text with a ✏️ icon to edit it before downloading.</p>

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
                        Approve as Week {nextWeekNumber}
                      </Button>
                    </>
                  ) : editSource === 'reuse' ? (
                    <>
                      <Button onClick={saveReusedPlan} className="gradient-primary text-primary-foreground">
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Save as Week {nextWeekNumber}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={approvePlan} disabled={isApproving} className="gradient-primary text-primary-foreground">
                      {isApproving ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Approving...</>
                      ) : (
                        <><CheckCircle2 className="h-4 w-4 mr-2" />Approve & Save as Week {nextWeekNumber}</>
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
                    <><CheckCircle2 className="h-4 w-4 mr-2" />Approve & Save as Week {nextWeekNumber}</>
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

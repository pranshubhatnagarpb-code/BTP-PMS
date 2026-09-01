import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Trash2, Download, Search, Calendar, User, Copy, Loader2, Edit, Check, X, FileText, FileSpreadsheet, StickyNote } from 'lucide-react';
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

  const generateOnePagerPDF = async (plan: any) => {
    if (!plan.is_ai_generated || !plan.ai_plan_data) {
      toast.error('Only AI-generated plans support one-pager PDF');
      return;
    }

    const planData = plan.ai_plan_data;
    const client = plan.clients;
    const dayGroups: any[] = planData.dayGroups || [];
    if (dayGroups.length === 0) { toast.error('No diet data found'); return; }

    // Load logo
    let logoDataUrl = '';
    try {
      const res = await fetch('/clinic-logo.png');
      const blob = await res.blob();
      logoDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (_) {}

    // Helpers
    const escHtml = (s: string) =>
      (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
    const fmtDate = (d: string) => {
      if (!d) return '';
      try {
        const dt = new Date(d);
        return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`;
      } catch { return d; }
    };
    const getRange = () => {
      const s = planData.editableStartDate || planData.startDate || '';
      if (!s) return 'N/A';
      try {
        const start = new Date(s);
        const days = parseInt(planData.editableDayCount || String(dayGroups.length));
        const end = new Date(start); end.setDate(start.getDate() + days - 1);
        return `${fmtDate(s)} to ${fmtDate(end.toISOString().split('T')[0])}`;
      } catch { return s; }
    };

    // Pivot data
    const mealTimes: { period: string; time: string }[] =
      (dayGroups[0]?.meals || []).map((m: any) => ({ period: m.period || '', time: m.time || '' }));
    const colHeaders = dayGroups.map((g: any) => escHtml(g.label || ''));
    const bodyRows = mealTimes.map((mt, mIdx) => ({
      period: mt.period,
      time: mt.time,
      cells: dayGroups.map((g: any) => escHtml(g.meals?.[mIdx]?.foodPlan || '')),
    }));

    const title = `One page Lifestyle plan for ${client?.name || plan.plan_name}`;

    // ── Realistic SVG vegetable corner decorations ────────────────────────────
    const svgToDataUrl = (svg: string) => {
      const encoded = encodeURIComponent(svg)
        .replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)));
      return 'data:image/svg+xml;base64,' + btoa(encoded);
    };

    // Top-right corner: carrots hanging down, 2 tomatoes, cabbage leaves, garlic
    const topRightSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 230">
  <defs>
    <radialGradient id="tom1" cx="32%" cy="26%" r="70%">
      <stop offset="0%" stop-color="#FF7070"/>
      <stop offset="40%" stop-color="#E53935"/>
      <stop offset="80%" stop-color="#C62828"/>
      <stop offset="100%" stop-color="#8B1A1A"/>
    </radialGradient>
    <radialGradient id="tom2" cx="32%" cy="26%" r="70%">
      <stop offset="0%" stop-color="#FF8A65"/>
      <stop offset="45%" stop-color="#E64A19"/>
      <stop offset="100%" stop-color="#8D2200"/>
    </radialGradient>
    <linearGradient id="cr1" x1="5%" y1="0%" x2="95%" y2="0%">
      <stop offset="0%" stop-color="#FF9800"/>
      <stop offset="30%" stop-color="#F57C00"/>
      <stop offset="65%" stop-color="#EF6C00"/>
      <stop offset="100%" stop-color="#E65100"/>
    </linearGradient>
    <linearGradient id="cr2" x1="5%" y1="0%" x2="95%" y2="0%">
      <stop offset="0%" stop-color="#FFB300"/>
      <stop offset="30%" stop-color="#FF8F00"/>
      <stop offset="65%" stop-color="#FB8C00"/>
      <stop offset="100%" stop-color="#EF6C00"/>
    </linearGradient>
    <linearGradient id="lf1" x1="0%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#AED581"/>
      <stop offset="55%" stop-color="#558B2F"/>
      <stop offset="100%" stop-color="#1B5E20"/>
    </linearGradient>
    <linearGradient id="lf2" x1="0%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#C5E1A5"/>
      <stop offset="100%" stop-color="#33691E"/>
    </linearGradient>
    <radialGradient id="gar" cx="38%" cy="28%" r="62%">
      <stop offset="0%" stop-color="#FFFFF2"/>
      <stop offset="100%" stop-color="#E8E0B8"/>
    </radialGradient>
  </defs>

  <!-- Big sweeping background leaf 1 -->
  <path d="M188,0 Q268,-22 300,32 Q282,94 240,108 Q200,114 174,74 Q154,44 188,0Z" fill="url(#lf1)" opacity="0.9"/>
  <!-- Midrib + branching veins -->
  <path d="M244,54 Q268,32 274,6" stroke="#1B5E20" stroke-width="2" fill="none" opacity="0.5"/>
  <path d="M244,54 Q246,78 240,104" stroke="#1B5E20" stroke-width="2" fill="none" opacity="0.5"/>
  <path d="M244,54 Q222,66 208,84" stroke="#1B5E20" stroke-width="1.2" fill="none" opacity="0.4"/>
  <path d="M244,54 Q266,68 278,84" stroke="#1B5E20" stroke-width="1.2" fill="none" opacity="0.4"/>
  <path d="M228,28 Q246,20 258,8" stroke="#2E7D32" stroke-width="0.9" fill="none" opacity="0.35"/>
  <path d="M256,76 Q270,76 282,70" stroke="#2E7D32" stroke-width="0.9" fill="none" opacity="0.35"/>

  <!-- Background leaf 2, lighter -->
  <path d="M144,0 Q206,-20 222,18 Q214,60 180,72 Q150,74 134,50 Q120,26 144,0Z" fill="url(#lf2)" opacity="0.78"/>
  <path d="M180,34 Q184,14 180,0" stroke="#33691E" stroke-width="1.3" fill="none" opacity="0.45"/>
  <path d="M180,34 Q174,56 168,70" stroke="#33691E" stroke-width="1.3" fill="none" opacity="0.45"/>
  <path d="M165,20 Q174,14 180,6" stroke="#33691E" stroke-width="0.8" fill="none" opacity="0.3"/>
  <path d="M192,22 Q185,14 182,6" stroke="#33691E" stroke-width="0.8" fill="none" opacity="0.3"/>

  <!-- Smaller third leaf -->
  <path d="M106,0 Q148,-16 162,14 Q154,46 128,54 Q104,54 92,30 Q82,10 106,0Z" fill="#66BB6A" opacity="0.78"/>
  <path d="M128,26 Q130,10 128,0" stroke="#2E7D32" stroke-width="1" fill="none" opacity="0.4"/>
  <path d="M128,26 Q122,42 118,52" stroke="#2E7D32" stroke-width="1" fill="none" opacity="0.4"/>

  <!-- Herb sprigs at top-right corner -->
  <path d="M272,0 Q281,16 274,30 Q266,16 272,0Z" fill="#2E7D32" opacity="0.96"/>
  <path d="M281,0 Q292,18 283,32 Q276,18 281,0Z" fill="#1B5E20" opacity="0.92"/>
  <path d="M290,3 Q300,20 292,35 Q284,20 290,3Z" fill="#33691E" opacity="0.94"/>

  <!-- === CARROT 1 === -->
  <!-- Tapering body: wide at top (near 0), narrows toward tip at y~115 -->
  <path d="M76,0 Q87,0 88,8 Q90,45 89,86 Q87,106 83,118 Q80,108 79,86 Q77,45 75,8 Q75,0 76,0Z" fill="url(#cr1)"/>
  <!-- Horizontal ridges across body -->
  <path d="M77,14 Q83,17 88,14" stroke="#BF360C" stroke-width="1.1" fill="none" opacity="0.55"/>
  <path d="M77,26 Q83,29 88,26" stroke="#BF360C" stroke-width="1.1" fill="none" opacity="0.55"/>
  <path d="M77,38 Q83,41 88,38" stroke="#BF360C" stroke-width="1" fill="none" opacity="0.5"/>
  <path d="M77,50 Q83,53 87,50" stroke="#BF360C" stroke-width="1" fill="none" opacity="0.5"/>
  <path d="M77,62 Q82,65 87,62" stroke="#BF360C" stroke-width="1" fill="none" opacity="0.48"/>
  <path d="M78,74 Q82,77 86,74" stroke="#BF360C" stroke-width="1" fill="none" opacity="0.45"/>
  <path d="M78,86 Q82,89 85,86" stroke="#BF360C" stroke-width="0.9" fill="none" opacity="0.4"/>
  <path d="M79,98 Q82,100 84,98" stroke="#BF360C" stroke-width="0.9" fill="none" opacity="0.38"/>
  <path d="M80,108 Q82,110 83,108" stroke="#BF360C" stroke-width="0.8" fill="none" opacity="0.35"/>
  <!-- Left highlight streak -->
  <path d="M78,2 Q80,55 79,115" stroke="white" stroke-width="2.5" fill="none" opacity="0.2" stroke-linecap="round"/>
  <!-- Root tip hairs -->
  <path d="M83,118 Q81,126 82,132" stroke="#E65100" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M83,118 Q85,124 84,130" stroke="#EF6C00" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <!-- Feathery greens — 5 fronds curving away from top -->
  <path d="M79,2 Q68,-22 50,-34 Q64,-16 77,5" fill="#388E3C" opacity="0.95"/>
  <path d="M80,2 Q74,-26 70,-40 Q75,-22 79,5" fill="#33691E" opacity="0.92"/>
  <path d="M82,2 Q86,-24 88,-38 Q85,-18 82,5" fill="#2E7D32" opacity="0.95"/>
  <path d="M83,1 Q93,-20 104,-30 Q94,-14 84,4" fill="#388E3C" opacity="0.88"/>
  <path d="M84,1 Q98,-16 116,-20 Q102,-8 85,4" fill="#43A047" opacity="0.82"/>
  <!-- Vein lines in carrot greens -->
  <path d="M52,-32 Q60,-18 76,4" stroke="#1B5E20" stroke-width="1" fill="none" opacity="0.5"/>
  <path d="M88,-36 Q86,-22 83,4" stroke="#1B5E20" stroke-width="1" fill="none" opacity="0.5"/>
  <path d="M116,-18 Q102,-8 85,4" stroke="#1B5E20" stroke-width="0.9" fill="none" opacity="0.45"/>

  <!-- === CARROT 2 === -->
  <path d="M105,0 Q116,0 117,7 Q119,42 117,80 Q115,98 111,110 Q108,100 107,80 Q105,42 104,7 Q104,0 105,0Z" fill="url(#cr2)"/>
  <path d="M106,13 Q111,16 116,13" stroke="#BF360C" stroke-width="1" fill="none" opacity="0.5"/>
  <path d="M106,25 Q111,28 116,25" stroke="#BF360C" stroke-width="1" fill="none" opacity="0.5"/>
  <path d="M106,37 Q111,40 115,37" stroke="#BF360C" stroke-width="1" fill="none" opacity="0.48"/>
  <path d="M106,49 Q110,52 114,49" stroke="#BF360C" stroke-width="1" fill="none" opacity="0.45"/>
  <path d="M106,61 Q110,64 114,61" stroke="#BF360C" stroke-width="0.9" fill="none" opacity="0.45"/>
  <path d="M106,73 Q109,76 113,73" stroke="#BF360C" stroke-width="0.9" fill="none" opacity="0.4"/>
  <path d="M107,85 Q110,88 112,85" stroke="#BF360C" stroke-width="0.9" fill="none" opacity="0.38"/>
  <path d="M107,97 Q110,99 112,97" stroke="#BF360C" stroke-width="0.8" fill="none" opacity="0.35"/>
  <path d="M107,2 Q109,48 108,107" stroke="white" stroke-width="2" fill="none" opacity="0.18" stroke-linecap="round"/>
  <path d="M111,110 Q109,118 110,124" stroke="#E65100" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M111,110 Q113,116 112,122" stroke="#EF6C00" stroke-width="1" fill="none" stroke-linecap="round"/>
  <!-- Carrot 2 greens -->
  <path d="M106,1 Q97,-20 82,-30 Q96,-14 104,4" fill="#4CAF50" opacity="0.9"/>
  <path d="M107,1 Q103,-22 100,-36 Q104,-18 106,4" fill="#388E3C" opacity="0.88"/>
  <path d="M109,1 Q114,-20 118,-34 Q114,-16 109,4" fill="#2E7D32" opacity="0.92"/>
  <path d="M110,1 Q120,-16 132,-22 Q122,-10 111,4" fill="#33691E" opacity="0.85"/>
  <path d="M84,-28 Q90,-16 103,3" stroke="#1B5E20" stroke-width="0.9" fill="none" opacity="0.45"/>
  <path d="M118,-32 Q116,-18 110,3" stroke="#1B5E20" stroke-width="0.9" fill="none" opacity="0.45"/>

  <!-- === TOMATO 1 (large) === -->
  <circle cx="182" cy="132" r="47" fill="url(#tom1)"/>
  <!-- Faint rib lines on surface -->
  <path d="M182,132 Q197,114 202,86" stroke="#9A1A1A" stroke-width="1" fill="none" opacity="0.18"/>
  <path d="M182,132 Q167,114 162,86" stroke="#9A1A1A" stroke-width="1" fill="none" opacity="0.18"/>
  <path d="M182,132 Q205,134 222,122" stroke="#9A1A1A" stroke-width="1" fill="none" opacity="0.14"/>
  <path d="M182,132 Q159,134 142,122" stroke="#9A1A1A" stroke-width="1" fill="none" opacity="0.14"/>
  <!-- Outer dark rim shadow -->
  <circle cx="182" cy="132" r="47" fill="none" stroke="#7A1818" stroke-width="3" opacity="0.18"/>
  <!-- Specular highlights -->
  <ellipse cx="160" cy="110" rx="19" ry="13" fill="white" opacity="0.22" transform="rotate(-28 160 110)"/>
  <ellipse cx="155" cy="105" rx="9" ry="6" fill="white" opacity="0.38" transform="rotate(-28 155 105)"/>
  <ellipse cx="150" cy="103" rx="4" ry="2.5" fill="white" opacity="0.45" transform="rotate(-28 150 103)"/>
  <!-- Calyx — 5 sepals radiating from center -->
  <path d="M182,87 Q174,95 172,106 Q182,98 192,106 Q190,95 182,87Z" fill="#2E7D32"/>
  <path d="M174,90 Q161,94 159,107 Q169,100 172,110 Q181,99 174,90Z" fill="#388E3C"/>
  <path d="M190,90 Q203,94 205,107 Q195,100 192,110 Q183,99 190,90Z" fill="#388E3C"/>
  <path d="M167,95 Q154,106 159,120 Q168,109 178,117 Q177,106 167,95Z" fill="#43A047"/>
  <path d="M197,95 Q210,106 205,120 Q196,109 186,117 Q185,106 197,95Z" fill="#43A047"/>
  <!-- Stem -->
  <path d="M182,85 Q184,72 181,62" stroke="#1B5E20" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <path d="M182,85 Q178,74 179,64" stroke="#33691E" stroke-width="1.5" fill="none" stroke-linecap="round"/>

  <!-- === TOMATO 2 (smaller, partially behind big one) === -->
  <circle cx="252" cy="108" r="32" fill="url(#tom2)"/>
  <circle cx="252" cy="108" r="32" fill="none" stroke="#7A2000" stroke-width="2" opacity="0.18"/>
  <ellipse cx="236" cy="94" rx="11" ry="7.5" fill="white" opacity="0.22" transform="rotate(-25 236 94)"/>
  <ellipse cx="232" cy="91" rx="5" ry="3.5" fill="white" opacity="0.36" transform="rotate(-25 232 91)"/>
  <!-- Calyx -->
  <path d="M252,77 Q245,83 244,92 Q252,87 260,92 Q259,83 252,77Z" fill="#2E7D32"/>
  <path d="M246,79 Q235,83 234,93 Q243,87 245,96 Q252,87 246,79Z" fill="#388E3C"/>
  <path d="M258,79 Q269,83 270,93 Q261,87 259,96 Q252,87 258,79Z" fill="#388E3C"/>
  <!-- Stem -->
  <path d="M252,75 Q254,65 251,56" stroke="#1B5E20" stroke-width="3" fill="none" stroke-linecap="round"/>

  <!-- === GARLIC BULB === -->
  <ellipse cx="50" cy="162" rx="25" ry="22" fill="url(#gar)"/>
  <ellipse cx="50" cy="162" rx="25" ry="22" fill="none" stroke="#D0C890" stroke-width="1.8"/>
  <!-- Papery skin top -->
  <path d="M38,150 Q50,141 62,150 Q56,138 50,136 Q44,138 38,150Z" fill="#F5F0D2" opacity="0.95"/>
  <!-- Clove division lines -->
  <path d="M50,142 Q42,152 44,170" stroke="#D0C890" stroke-width="1.4" fill="none" opacity="0.65"/>
  <path d="M50,142 Q58,152 56,170" stroke="#D0C890" stroke-width="1.4" fill="none" opacity="0.65"/>
  <path d="M36,153 Q44,161 42,176" stroke="#C8C080" stroke-width="1.1" fill="none" opacity="0.5"/>
  <path d="M64,153 Q56,161 58,176" stroke="#C8C080" stroke-width="1.1" fill="none" opacity="0.5"/>
  <!-- Root fronds -->
  <path d="M50,184 Q47,192 48,198" stroke="#C0B070" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M50,184 Q53,191 52,197" stroke="#C8B878" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M45,182 Q41,189 43,194" stroke="#C8B878" stroke-width="1.1" fill="none" stroke-linecap="round"/>
  <!-- Stem growing up -->
  <path d="M50,134 Q49,122 50,110" stroke="#8BC34A" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- Two small leaves from stem -->
  <path d="M50,110 Q40,96 38,82 Q47,96 50,110Z" fill="#7CB342" opacity="0.9"/>
  <path d="M50,110 Q60,96 62,82 Q53,96 50,110Z" fill="#558B2F" opacity="0.85"/>
  <path d="M50,98 Q45,90 40,84" stroke="#33691E" stroke-width="1" fill="none" opacity="0.5"/>
  <path d="M50,98 Q55,90 60,84" stroke="#33691E" stroke-width="1" fill="none" opacity="0.5"/>

  <!-- Stray herb leaves near bottom -->
  <path d="M34,208 Q48,188 64,194 Q52,212 34,208Z" fill="#4CAF50" opacity="0.88"/>
  <path d="M34,208 Q46,214 54,226 Q42,220 34,208Z" fill="#66BB6A" opacity="0.82"/>
  <path d="M48,196 Q49,210 54,226" stroke="#2E7D32" stroke-width="1.3" fill="none" opacity="0.5"/>

  <!-- === RED CHILI PEPPERS (lower-left empty area) === -->
  <!-- Chili 1 — curved, pointing lower-right -->
  <path d="M8,126 Q2,134 4,150 Q8,164 16,160 Q24,154 20,138 Q16,124 8,126Z" fill="#E53935"/>
  <ellipse cx="9" cy="140" rx="3" ry="7" fill="white" opacity="0.2" transform="rotate(12 9 140)"/>
  <path d="M10,158 Q8,164 10,168" stroke="#B71C1C" stroke-width="1.2" fill="none" opacity="0.7" stroke-linecap="round"/>
  <path d="M9,124 Q8,116 10,106" stroke="#2E7D32" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M9,108 Q4,102 2,96" stroke="#388E3C" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <!-- Chili 2 — slightly larger, behind chili 1 -->
  <path d="M22,142 Q15,152 17,168 Q21,182 30,178 Q38,172 36,156 Q32,142 22,142Z" fill="#F44336"/>
  <ellipse cx="22" cy="158" rx="3" ry="8" fill="white" opacity="0.18" transform="rotate(8 22 158)"/>
  <path d="M25,176 Q23,182 25,188" stroke="#C62828" stroke-width="1.2" fill="none" opacity="0.65" stroke-linecap="round"/>
  <path d="M23,140 Q21,130 23,120" stroke="#33691E" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M23,120 Q28,112 30,104" stroke="#2E7D32" stroke-width="1.4" fill="none" stroke-linecap="round"/>
  <!-- Chili 3 — small, bright red, pointing up-right -->
  <path d="M36,148 Q30,140 26,128 Q28,122 34,124 Q40,130 40,144 Q40,152 36,148Z" fill="#EF5350"/>
  <ellipse cx="32" cy="136" rx="2.5" ry="6" fill="white" opacity="0.2" transform="rotate(-20 32 136)"/>
  <path d="M34,124 Q36,116 36,108" stroke="#388E3C" stroke-width="2" fill="none" stroke-linecap="round"/>

  <!-- === RED BELL PEPPER (lower-center area) === -->
  <path d="M138,162 Q126,170 124,188 Q124,208 138,216 Q154,222 166,214 Q176,204 174,186 Q172,168 160,162 Q150,156 138,162Z" fill="#D32F2F"/>
  <!-- Bell pepper dark rib seams -->
  <path d="M144,166 Q142,190 144,214" stroke="#B71C1C" stroke-width="1.2" fill="none" opacity="0.32"/>
  <path d="M158,164 Q158,190 160,214" stroke="#B71C1C" stroke-width="1.2" fill="none" opacity="0.32"/>
  <!-- Highlight -->
  <ellipse cx="134" cy="180" rx="9" ry="14" fill="white" opacity="0.2" transform="rotate(-10 134 180)"/>
  <ellipse cx="132" cy="176" rx="4.5" ry="7" fill="white" opacity="0.3" transform="rotate(-10 132 176)"/>
  <!-- Lobe bumps at base -->
  <ellipse cx="138" cy="215" rx="8" ry="4" fill="#C62828" opacity="0.85"/>
  <ellipse cx="152" cy="218" rx="8" ry="4" fill="#C62828" opacity="0.85"/>
  <ellipse cx="165" cy="213" rx="7" ry="4" fill="#B71C1C" opacity="0.85"/>
  <!-- Calyx star -->
  <path d="M150,160 Q144,150 140,140 Q147,152 151,162Z" fill="#2E7D32"/>
  <path d="M150,160 Q156,150 160,140 Q153,152 149,162Z" fill="#33691E"/>
  <path d="M150,160 Q148,148 150,136" stroke="#388E3C" stroke-width="2.8" fill="none" stroke-linecap="round"/>

  <!-- === BROCCOLI CLUSTER (gap between carrot tips and bell pepper) === -->
  <!-- Main dome floret -->
  <circle cx="188" cy="152" r="16" fill="#2E7D32" opacity="0.92"/>
  <circle cx="176" cy="157" r="13" fill="#388E3C" opacity="0.9"/>
  <circle cx="200" cy="156" r="12" fill="#33691E" opacity="0.9"/>
  <!-- Smaller sub-florets -->
  <circle cx="182" cy="143" r="10" fill="#43A047" opacity="0.88"/>
  <circle cx="196" cy="145" r="9"  fill="#2E7D32" opacity="0.88"/>
  <circle cx="170" cy="150" r="9"  fill="#388E3C" opacity="0.85"/>
  <circle cx="206" cy="150" r="8"  fill="#1B5E20" opacity="0.88"/>
  <!-- Tiny highlight dots on florets -->
  <circle cx="180" cy="146" r="3" fill="#A5D6A7" opacity="0.45"/>
  <circle cx="194" cy="147" r="2.5" fill="#81C784" opacity="0.4"/>
  <circle cx="174" cy="153" r="2.5" fill="#A5D6A7" opacity="0.38"/>
  <!-- Thick stalk -->
  <path d="M188,168 Q186,180 186,190" stroke="#1B5E20" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M188,168 Q190,180 190,190" stroke="#2E7D32" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- Stalk highlight -->
  <path d="M187,168 Q186,178 186,188" stroke="#66BB6A" stroke-width="1.5" fill="none" opacity="0.3" stroke-linecap="round"/>
  <!-- Small side branches -->
  <path d="M187,176 Q180,174 175,170" stroke="#2E7D32" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M188,180 Q196,178 202,174" stroke="#1B5E20" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <!-- Tiny florets at branch tips -->
  <circle cx="174" cy="169" r="5" fill="#388E3C" opacity="0.85"/>
  <circle cx="203" cy="173" r="5" fill="#2E7D32" opacity="0.85"/>
  <circle cx="173" cy="167" r="3" fill="#66BB6A" opacity="0.5"/>
  <circle cx="204" cy="171" r="3" fill="#66BB6A" opacity="0.45"/>

  <!-- === SMALL RADISH (right of garlic) === -->
  <circle cx="92" cy="164" r="18" fill="#E91E63"/>
  <circle cx="92" cy="164" r="18" fill="none" stroke="#AD1457" stroke-width="1.5" opacity="0.22"/>
  <!-- Radish white bottom -->
  <path d="M80,172 Q82,182 92,186 Q102,182 104,172 Q98,178 92,180 Q86,178 80,172Z" fill="#FFF9C4"/>
  <!-- Highlight -->
  <ellipse cx="82" cy="156" rx="7" ry="5" fill="white" opacity="0.32" transform="rotate(-25 82 156)"/>
  <ellipse cx="80" cy="153" rx="3.5" ry="2.5" fill="white" opacity="0.45" transform="rotate(-25 80 153)"/>
  <!-- Root tail -->
  <path d="M92,182 Q91,190 92,196" stroke="#F48FB1" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <!-- Leaf tops -->
  <path d="M88,146 Q80,130 74,118 Q82,132 89,148" fill="#43A047" opacity="0.92"/>
  <path d="M90,145 Q86,128 86,114 Q90,130 91,147" fill="#388E3C" opacity="0.9"/>
  <path d="M92,145 Q96,128 100,116 Q96,130 93,147" fill="#2E7D32" opacity="0.92"/>
  <path d="M94,145 Q100,130 108,118 Q102,132 95,147" fill="#43A047" opacity="0.88"/>
  <path d="M86,128 Q82,120 76,118" stroke="#1B5E20" stroke-width="1" fill="none" opacity="0.5"/>
  <path d="M94,128 Q98,120 102,118" stroke="#1B5E20" stroke-width="1" fill="none" opacity="0.5"/>
</svg>`;

    // Bottom-left corner: beetroot, cucumber, lemon, spinach leaves
    const bottomLeftSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 210">
  <defs>
    <radialGradient id="bt1" cx="33%" cy="26%" r="68%">
      <stop offset="0%" stop-color="#E040FB"/>
      <stop offset="40%" stop-color="#8E24AA"/>
      <stop offset="80%" stop-color="#6A1B9A"/>
      <stop offset="100%" stop-color="#4A148C"/>
    </radialGradient>
    <radialGradient id="bt2" cx="33%" cy="26%" r="68%">
      <stop offset="0%" stop-color="#F48FB1"/>
      <stop offset="45%" stop-color="#C2185B"/>
      <stop offset="100%" stop-color="#880E4F"/>
    </radialGradient>
    <radialGradient id="lem" cx="32%" cy="27%" r="68%">
      <stop offset="0%" stop-color="#FFFDE7"/>
      <stop offset="45%" stop-color="#FFF176"/>
      <stop offset="80%" stop-color="#FFEE58"/>
      <stop offset="100%" stop-color="#F9A825"/>
    </radialGradient>
    <linearGradient id="cu" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#43A047"/>
      <stop offset="45%" stop-color="#2E7D32"/>
      <stop offset="100%" stop-color="#1B5E20"/>
    </linearGradient>
    <linearGradient id="sp1" x1="0%" y1="0%" x2="90%" y2="100%">
      <stop offset="0%" stop-color="#A5D6A7"/>
      <stop offset="55%" stop-color="#43A047"/>
      <stop offset="100%" stop-color="#1B5E20"/>
    </linearGradient>
    <linearGradient id="sp2" x1="0%" y1="0%" x2="90%" y2="100%">
      <stop offset="0%" stop-color="#C8E6C9"/>
      <stop offset="100%" stop-color="#2E7D32"/>
    </linearGradient>
  </defs>

  <!-- === LEAFY GREENS (spinach/chard) fanning from bottom-left === -->
  <!-- Leaf A — largest, back -->
  <path d="M0,210 Q36,152 96,142 Q74,182 32,210Z" fill="url(#sp1)" opacity="0.9"/>
  <!-- Midrib -->
  <path d="M16,208 Q52,168 92,144" stroke="#1B5E20" stroke-width="2" fill="none" opacity="0.5"/>
  <!-- Secondary veins -->
  <path d="M26,200 Q44,182 58,172" stroke="#2E7D32" stroke-width="1" fill="none" opacity="0.4"/>
  <path d="M44,196 Q62,180 74,170" stroke="#2E7D32" stroke-width="1" fill="none" opacity="0.4"/>

  <!-- Leaf B -->
  <path d="M0,210 Q48,144 112,138 Q88,176 46,210Z" fill="url(#sp2)" opacity="0.78"/>
  <path d="M22,206 Q60,164 108,140" stroke="#1B5E20" stroke-width="1.5" fill="none" opacity="0.45"/>
  <path d="M38,202 Q62,180 86,162" stroke="#2E7D32" stroke-width="0.9" fill="none" opacity="0.35"/>

  <!-- Leaf C — brightest, front -->
  <path d="M0,205 Q52,138 122,134 Q96,170 54,205Z" fill="#66BB6A" opacity="0.72"/>
  <path d="M28,202 Q66,162 118,136" stroke="#33691E" stroke-width="1.2" fill="none" opacity="0.4"/>

  <!-- Upper-left rosette leaf -->
  <path d="M0,95 Q30,56 76,66 Q54,106 14,110 Q-4,102 0,95Z" fill="url(#sp1)" opacity="0.85"/>
  <path d="M6,96 Q36,72 72,68" stroke="#1B5E20" stroke-width="1.6" fill="none" opacity="0.5"/>
  <path d="M10,104 Q32,88 54,80" stroke="#1B5E20" stroke-width="0.9" fill="none" opacity="0.38"/>
  <path d="M22,108 Q38,96 54,88" stroke="#1B5E20" stroke-width="0.9" fill="none" opacity="0.35"/>

  <!-- Second upper leaf -->
  <path d="M0,105 Q34,64 82,72 Q60,110 20,116 Q0,110 0,105Z" fill="#81C784" opacity="0.62"/>
  <path d="M8,108 Q38,82 78,74" stroke="#2E7D32" stroke-width="1.2" fill="none" opacity="0.4"/>

  <!-- === CUCUMBER (whole, diagonal) === -->
  <!-- Body shape — oblong, slightly tapered -->
  <path d="M0,58 Q10,48 26,44 Q68,37 108,60 Q122,72 112,88 Q100,104 62,104 Q24,100 8,84 Q-5,70 0,58Z" fill="url(#cu)"/>
  <!-- Longitudinal light ridges (run along length) -->
  <path d="M18,46 Q24,100 26,104" stroke="#66BB6A" stroke-width="3.5" fill="none" opacity="0.42" stroke-linecap="round"/>
  <path d="M38,43 Q42,100 44,104" stroke="#66BB6A" stroke-width="3" fill="none" opacity="0.38" stroke-linecap="round"/>
  <path d="M58,40 Q60,98 62,104" stroke="#66BB6A" stroke-width="3" fill="none" opacity="0.36" stroke-linecap="round"/>
  <path d="M78,42 Q80,96 82,104" stroke="#66BB6A" stroke-width="2.5" fill="none" opacity="0.33" stroke-linecap="round"/>
  <path d="M96,46 Q98,92 100,102" stroke="#66BB6A" stroke-width="2.5" fill="none" opacity="0.3" stroke-linecap="round"/>
  <!-- Top highlight -->
  <path d="M8,62 Q50,50 100,66" stroke="white" stroke-width="5" fill="none" opacity="0.14" stroke-linecap="round"/>
  <!-- End caps -->
  <ellipse cx="7" cy="70" rx="9" ry="14" fill="#1B5E20"/>
  <path d="M3,64 Q2,70 3,76" stroke="#388E3C" stroke-width="1.2" fill="none" opacity="0.55"/>
  <path d="M11,61 Q11,70 11,79" stroke="#388E3C" stroke-width="1.2" fill="none" opacity="0.45"/>
  <ellipse cx="110" cy="74" rx="8" ry="13" fill="#1B5E20"/>
  <!-- Stem -->
  <path d="M7,57 Q2,48 -2,38" stroke="#2E7D32" stroke-width="3" fill="none" stroke-linecap="round"/>

  <!-- === BEETROOT 1 (main) === -->
  <!-- Slightly irregular bulbous shape instead of perfect circle -->
  <path d="M118,148 Q118,108 148,102 Q180,98 198,124 Q210,148 200,172 Q188,198 158,200 Q128,200 116,176 Q108,160 118,148Z" fill="url(#bt1)"/>
  <!-- Rim shadow -->
  <path d="M118,148 Q118,108 148,102 Q180,98 198,124 Q210,148 200,172 Q188,198 158,200 Q128,200 116,176 Q108,160 118,148Z" fill="none" stroke="#4A148C" stroke-width="2.5" opacity="0.2"/>
  <!-- Specular highlights -->
  <ellipse cx="136" cy="122" rx="15" ry="10" fill="white" opacity="0.22" transform="rotate(-22 136 122)"/>
  <ellipse cx="132" cy="117" rx="7" ry="4.5" fill="white" opacity="0.35" transform="rotate(-22 132 117)"/>
  <ellipse cx="128" cy="114" rx="3.5" ry="2" fill="white" opacity="0.42" transform="rotate(-22 128 114)"/>
  <!-- Root tail (tapering downward) -->
  <path d="M158,200 Q155,210 154,210" stroke="#4A148C" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M158,204 Q162,210 161,210" stroke="#6A1B9A" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- Leaf stems — 5 leaves with red-tinged stalks -->
  <!-- Left leaf -->
  <path d="M142,106 Q124,76 108,58 Q126,80 144,108" fill="#C62828" opacity="0.8"/>
  <path d="M143,105 Q128,74 118,56 Q133,78 145,107" fill="#4CAF50" opacity="0.9"/>
  <path d="M143,105 Q128,76 118,58" stroke="#B71C1C" stroke-width="1.8" fill="none" opacity="0.5"/>
  <!-- Left-center leaf -->
  <path d="M151,102 Q140,70 132,50 Q146,72 153,104" fill="#EF5350" opacity="0.7"/>
  <path d="M152,101 Q142,70 134,50 Q148,72 154,103" fill="#43A047" opacity="0.9"/>
  <path d="M152,101 Q142,72 134,52" stroke="#B71C1C" stroke-width="1.5" fill="none" opacity="0.48"/>
  <!-- Center leaf -->
  <path d="M158,100 Q156,68 156,48 Q160,70 160,100" fill="#2E7D32" opacity="0.96"/>
  <path d="M157,100 Q156,70 156,50" stroke="#1B5E20" stroke-width="1.8" fill="none" opacity="0.5"/>
  <!-- Right-center leaf -->
  <path d="M165,101 Q174,70 182,50 Q170,72 163,103" fill="#43A047" opacity="0.9"/>
  <path d="M164,101 Q172,72 180,52" stroke="#B71C1C" stroke-width="1.5" fill="none" opacity="0.48"/>
  <!-- Right leaf -->
  <path d="M173,105 Q188,74 202,56 Q184,80 171,107" fill="#4CAF50" opacity="0.9"/>
  <path d="M174,105 Q188,76 202,58" stroke="#B71C1C" stroke-width="1.8" fill="none" opacity="0.5"/>
  <!-- Lateral leaf veins -->
  <path d="M136,84 Q128,78 120,70" stroke="#2E7D32" stroke-width="1" fill="none" opacity="0.4"/>
  <path d="M146,72 Q140,66 134,60" stroke="#2E7D32" stroke-width="0.9" fill="none" opacity="0.38"/>
  <path d="M178,84 Q186,78 194,70" stroke="#2E7D32" stroke-width="1" fill="none" opacity="0.4"/>

  <!-- === BEETROOT 2 (smaller) === -->
  <path d="M220,162 Q218,138 234,132 Q254,128 268,146 Q276,162 268,178 Q258,196 240,196 Q222,196 216,180 Q212,170 220,162Z" fill="url(#bt2)"/>
  <path d="M220,162 Q218,138 234,132 Q254,128 268,146 Q276,162 268,178 Q258,196 240,196 Q222,196 216,180 Q212,170 220,162Z" fill="none" stroke="#880E4F" stroke-width="2" opacity="0.18"/>
  <ellipse cx="226" cy="146" rx="10" ry="7" fill="white" opacity="0.2" transform="rotate(-18 226 146)"/>
  <path d="M240,196 Q238,204 237,210" stroke="#880E4F" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <!-- Leaves -->
  <path d="M232,134 Q224,112 216,96 Q226,114 234,136" fill="#43A047" opacity="0.9"/>
  <path d="M240,132 Q238,110 238,94 Q240,112 242,134" fill="#2E7D32" opacity="0.92"/>
  <path d="M248,134 Q256,112 264,96 Q254,114 246,136" fill="#43A047" opacity="0.9"/>
  <path d="M232,134 Q224,114 216,98" stroke="#C2185B" stroke-width="1.5" fill="none" opacity="0.48"/>
  <path d="M248,134 Q256,114 264,98" stroke="#C2185B" stroke-width="1.5" fill="none" opacity="0.48"/>

  <!-- === LEMON === -->
  <!-- Body -->
  <ellipse cx="294" cy="162" rx="36" ry="28" fill="url(#lem)"/>
  <ellipse cx="294" cy="162" rx="36" ry="28" fill="none" stroke="#F9A825" stroke-width="1.8" opacity="0.38"/>
  <!-- Pore texture dots -->
  <circle cx="280" cy="154" r="2" fill="#F9A825" opacity="0.42"/>
  <circle cx="292" cy="150" r="2" fill="#F9A825" opacity="0.38"/>
  <circle cx="305" cy="155" r="2" fill="#F9A825" opacity="0.4"/>
  <circle cx="285" cy="165" r="2" fill="#F9A825" opacity="0.36"/>
  <circle cx="298" cy="170" r="2" fill="#F9A825" opacity="0.35"/>
  <circle cx="310" cy="162" r="2" fill="#F9A825" opacity="0.33"/>
  <circle cx="276" cy="166" r="1.5" fill="#F9A825" opacity="0.3"/>
  <circle cx="306" cy="172" r="1.5" fill="#F9A825" opacity="0.3"/>
  <!-- Specular highlights -->
  <ellipse cx="276" cy="150" rx="13" ry="9" fill="white" opacity="0.34" transform="rotate(-26 276 150)"/>
  <ellipse cx="272" cy="147" rx="6" ry="4" fill="white" opacity="0.48" transform="rotate(-26 272 147)"/>
  <!-- End nubs -->
  <ellipse cx="258" cy="162" rx="7" ry="5.5" fill="#F9A825"/>
  <ellipse cx="330" cy="162" rx="7" ry="5.5" fill="#EF9A00"/>
  <!-- Leaves (two) -->
  <path d="M316,138 Q334,118 340,98 Q324,118 316,138Z" fill="#388E3C" opacity="0.94"/>
  <path d="M316,138 Q298,120 296,100 Q309,120 316,138Z" fill="#2E7D32" opacity="0.9"/>
  <path d="M316,138 Q318,120 320,102" stroke="#1B5E20" stroke-width="1.4" fill="none" opacity="0.55"/>
  <!-- Second smaller leaf -->
  <path d="M306,130 Q316,112 320,96 Q308,112 306,130Z" fill="#43A047" opacity="0.85"/>
  <path d="M306,130 Q294,115 294,100 Q302,116 306,130Z" fill="#33691E" opacity="0.8"/>

  <!-- Herb/coriander sprigs bottom-right -->
  <path d="M332,210 Q338,195 340,182 Q336,196 332,210Z" fill="#66BB6A" opacity="0.88"/>
  <path d="M338,196 Q340,181 337,170 Q334,182 338,196Z" fill="#4CAF50" opacity="0.85"/>
  <path d="M336,185 Q338,170 335,160 Q331,172 336,185Z" fill="#43A047" opacity="0.88"/>
  <path d="M332,210 Q334,198 338,196" stroke="#2E7D32" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M338,196 Q338,187 336,185" stroke="#2E7D32" stroke-width="1.4" fill="none" stroke-linecap="round"/>

  <!-- === ASPARAGUS SPEARS (empty gap above onion, x~165-210, y~30-110) === -->
  <!-- Spear 1 (tallest, center) -->
  <path d="M182,110 Q180,80 180,38 Q182,30 184,38 Q184,80 182,110Z" fill="#558B2F" opacity="0.92"/>
  <path d="M181,110 Q179,80 179,40" stroke="#8BC34A" stroke-width="1.2" fill="none" opacity="0.3" stroke-linecap="round"/>
  <!-- Scale bracts along spear 1 -->
  <path d="M180,90 Q176,84 178,78 Q182,84 182,90Z" fill="#33691E" opacity="0.75"/>
  <path d="M182,78 Q178,72 180,66 Q184,72 184,78Z" fill="#388E3C" opacity="0.72"/>
  <path d="M181,66 Q177,60 179,54 Q183,60 183,66Z" fill="#33691E" opacity="0.7"/>
  <path d="M181,54 Q177,48 180,42 Q184,48 184,54Z" fill="#2E7D32" opacity="0.68"/>
  <!-- Tip of spear 1 -->
  <ellipse cx="182" cy="32" rx="4" ry="7" fill="#1B5E20" opacity="0.95"/>
  <path d="M178,34 Q182,26 186,34" fill="#2E7D32" opacity="0.85"/>

  <!-- Spear 2 (slightly shorter, left) -->
  <path d="M170,110 Q168,84 168,46 Q170,38 172,46 Q172,84 170,110Z" fill="#689F38" opacity="0.9"/>
  <path d="M169,110 Q167,84 167,48" stroke="#9CCC65" stroke-width="1" fill="none" opacity="0.28" stroke-linecap="round"/>
  <path d="M168,92 Q164,86 166,80 Q170,86 170,92Z" fill="#33691E" opacity="0.7"/>
  <path d="M169,80 Q165,74 167,68 Q171,74 171,80Z" fill="#388E3C" opacity="0.68"/>
  <path d="M169,68 Q165,62 168,56 Q172,62 172,68Z" fill="#33691E" opacity="0.66"/>
  <path d="M169,56 Q165,50 168,44 Q172,50 172,56Z" fill="#2E7D32" opacity="0.64"/>
  <ellipse cx="170" cy="40" rx="3.5" ry="6" fill="#1B5E20" opacity="0.9"/>

  <!-- Spear 3 (shorter, right) -->
  <path d="M194,110 Q192,88 192,55 Q194,46 196,55 Q196,88 194,110Z" fill="#7CB342" opacity="0.88"/>
  <path d="M193,110 Q191,88 191,57" stroke="#AED581" stroke-width="1" fill="none" opacity="0.25" stroke-linecap="round"/>
  <path d="M192,94 Q188,88 190,82 Q194,88 194,94Z" fill="#558B2F" opacity="0.7"/>
  <path d="M193,82 Q189,76 191,70 Q195,76 195,82Z" fill="#4CAF50" opacity="0.65"/>
  <path d="M193,70 Q189,64 192,58 Q196,64 196,70Z" fill="#388E3C" opacity="0.62"/>
  <ellipse cx="194" cy="49" rx="3.5" ry="6" fill="#2E7D32" opacity="0.88"/>

  <!-- Spear 4 (shortest, far right) -->
  <path d="M206,110 Q204,92 204,66 Q206,58 208,66 Q208,92 206,110Z" fill="#8BC34A" opacity="0.86"/>
  <path d="M204,96 Q200,90 202,84 Q206,90 206,96Z" fill="#558B2F" opacity="0.65"/>
  <path d="M205,84 Q201,78 204,72 Q208,78 208,84Z" fill="#689F38" opacity="0.62"/>
  <ellipse cx="206" cy="61" rx="3" ry="5.5" fill="#33691E" opacity="0.88"/>

  <!-- Rubber band / tie holding them together -->
  <path d="M168,100 Q186,96 208,100" stroke="#8D6E63" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.7"/>
  <path d="M168,104 Q186,100 208,104" stroke="#795548" stroke-width="1.5" fill="none" stroke-linecap="round" opacity="0.5"/>

  <!-- === GOLDEN ONION (filling gap between cucumber and beetroot) === -->
  <path d="M118,110 Q108,120 106,138 Q106,158 120,168 Q136,176 152,168 Q166,158 166,138 Q166,118 154,110 Q142,102 128,102 Q122,104 118,110Z" fill="#FF8F00" opacity="0.94"/>
  <path d="M118,110 Q108,120 106,138 Q106,158 120,168 Q136,176 152,168 Q166,158 166,138 Q166,118 154,110 Q142,102 128,102 Q122,104 118,110Z" fill="none" stroke="#E65100" stroke-width="2" opacity="0.25"/>
  <!-- Onion highlight -->
  <ellipse cx="118" cy="126" rx="10" ry="7" fill="white" opacity="0.25" transform="rotate(-20 118 126)"/>
  <ellipse cx="116" cy="122" rx="5" ry="3.5" fill="white" opacity="0.38" transform="rotate(-20 116 122)"/>
  <!-- Ring lines curving around body -->
  <path d="M118,116 Q110,128 110,144 Q112,158 122,166" stroke="#E65100" stroke-width="1.3" fill="none" opacity="0.4"/>
  <path d="M124,108 Q116,122 116,142 Q118,160 128,170" stroke="#E65100" stroke-width="1.1" fill="none" opacity="0.35"/>
  <path d="M138,106 Q132,120 132,142 Q134,162 142,170" stroke="#BF360C" stroke-width="1" fill="none" opacity="0.28"/>
  <!-- Papery brown-orange skin at top -->
  <path d="M118,108 Q128,96 140,108 Q134,98 128,96 Q122,98 118,108Z" fill="#FFF3E0" opacity="0.9"/>
  <!-- Root end -->
  <path d="M128,174 Q126,182 127,188" stroke="#BF360C" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M128,176 Q132,183 130,188" stroke="#E65100" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M123,176 Q119,182 121,187" stroke="#E65100" stroke-width="1.2" fill="none" stroke-linecap="round"/>
  <!-- Green shoots -->
  <path d="M128,94 Q126,80 128,66" stroke="#7CB342" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M128,66 Q122,52 124,38" stroke="#8BC34A" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <path d="M128,66 Q134,52 132,38" stroke="#689F38" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <!-- Small leaf from shoot -->
  <path d="M126,52 Q114,44 108,34 Q118,42 126,54Z" fill="#7CB342" opacity="0.88"/>
  <path d="M130,52 Q142,44 148,34 Q138,42 130,54Z" fill="#558B2F" opacity="0.85"/>
  <path d="M128,44 Q122,38 116,34" stroke="#33691E" stroke-width="0.9" fill="none" opacity="0.5"/>
  <path d="M128,44 Q134,38 140,34" stroke="#33691E" stroke-width="0.9" fill="none" opacity="0.5"/>

  <!-- === CHERRY TOMATO CLUSTER (right of beetroot 2) === -->
  <!-- Stem/vine -->
  <path d="M280,118 Q282,124 278,132" stroke="#2E7D32" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M278,132 Q272,136 268,140" stroke="#2E7D32" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M278,132 Q284,136 288,142" stroke="#2E7D32" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M280,118 Q286,112 290,106" stroke="#388E3C" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <!-- Vine leaf -->
  <path d="M282,116 Q272,106 268,94 Q276,106 283,117Z" fill="#4CAF50" opacity="0.9"/>
  <path d="M282,116 Q292,106 296,94 Q288,106 281,117Z" fill="#388E3C" opacity="0.85"/>
  <!-- Cherry 1 -->
  <circle cx="268" cy="144" r="15" fill="#E53935"/>
  <circle cx="268" cy="144" r="15" fill="none" stroke="#B71C1C" stroke-width="1.5" opacity="0.2"/>
  <ellipse cx="261" cy="137" rx="5.5" ry="3.8" fill="white" opacity="0.3" transform="rotate(-25 261 137)"/>
  <ellipse cx="259" cy="135" rx="2.8" ry="1.8" fill="white" opacity="0.42" transform="rotate(-25 259 135)"/>
  <path d="M268,130 Q266,124 268,118" stroke="#1B5E20" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- Cherry 2 -->
  <circle cx="290" cy="146" r="14" fill="#EF5350"/>
  <circle cx="290" cy="146" r="14" fill="none" stroke="#C62828" stroke-width="1.5" opacity="0.18"/>
  <ellipse cx="284" cy="140" rx="5" ry="3.5" fill="white" opacity="0.28" transform="rotate(-25 284 140)"/>
  <path d="M290,133 Q290,127 290,120" stroke="#2E7D32" stroke-width="2" fill="none" stroke-linecap="round"/>
  <!-- Cherry 3 (smaller, lower) -->
  <circle cx="276" cy="162" r="12" fill="#F44336"/>
  <circle cx="276" cy="162" r="12" fill="none" stroke="#C62828" stroke-width="1.2" opacity="0.18"/>
  <ellipse cx="270" cy="157" rx="4.5" ry="3" fill="white" opacity="0.26" transform="rotate(-25 270 157)"/>
  <path d="M276,151 Q275,145 276,139" stroke="#388E3C" stroke-width="1.8" fill="none" stroke-linecap="round"/>
</svg>`;

    const topRightDecoUrl = svgToDataUrl(topRightSvg);
    const bottomDecoUrl   = svgToDataUrl(bottomLeftSvg);

    const content = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 9mm 12mm 7mm 12mm;
      color: #1a1a1a;
      background: #F7FAFF;
      position: relative;
    }

    /* Corner vegetable decorations */
    .deco { position: fixed; pointer-events: none; z-index: 0; }
    .deco-tr { top: 0; right: 0; width: 220px; opacity: 0.9; }
    .deco-bl { bottom: 0; left: 0; width: 270px; opacity: 0.88; }

    /* All visible content sits above decorations */
    .header, .kyc-bar, .table-wrap, .footer { position: relative; z-index: 1; }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      padding-bottom: 9px;
      margin-bottom: 8px;
      border-bottom: 3.5px solid #1565C0;
    }
    .header-logo { width: 90px; height: auto; flex-shrink: 0; }
    .header-center { flex: 1; text-align: center; padding: 0 16px; }
    .header-center h1 {
      font-size: 22px;
      font-weight: 900;
      color: #0D2E6A;
      letter-spacing: 0.2px;
      line-height: 1.2;
      text-transform: uppercase;
    }
    .header-center .subtitle {
      font-size: 11.5px;
      color: #1565C0;
      font-weight: 600;
      margin-top: 3px;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .header-center .date-line {
      font-size: 11px;
      color: #444;
      font-weight: 500;
      margin-top: 4px;
      letter-spacing: 0.3px;
    }
    .header-center .date-line b { color: #0D2E6A; font-weight: 700; }

    /* ── Pivot table wrapper ── */
    .table-wrap { border-radius: 6px; overflow: hidden; border: 1.5px solid #BBDEFB; box-shadow: 0 1px 6px rgba(21,101,192,0.1); }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }

    /* Blank top-left corner cell */
    th.corner {
      width: 82px;
      background: linear-gradient(135deg, #0D2E6A 0%, #1565C0 100%);
      border-right: 2px solid #1976D2;
    }

    /* Day column headers */
    th.day {
      font-size: 13px;
      font-weight: 800;
      color: #fff;
      text-align: center;
      padding: 8px 5px;
      background: linear-gradient(180deg, #1565C0 0%, #0D47A1 100%);
      border-right: 1px solid #1976D2;
      letter-spacing: 0.3px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
    }
    th.day:last-child { border-right: none; }

    /* Horizontal meal-time row labels */
    td.meal-label {
      width: 82px;
      text-align: center;
      vertical-align: middle;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      background: linear-gradient(90deg, #0D2E6A 0%, #1565C0 100%);
      color: #fff;
      padding: 5px 6px;
      border-bottom: 1px solid #1976D2;
      border-right: 2px solid #1976D2;
      line-height: 1.5;
    }
    .meal-time { font-size: 7.5px; font-weight: 500; letter-spacing: 0; text-transform: none; opacity: 0.85; margin-top: 1px; }

    /* Food content cells */
    td.food {
      padding: 5px 7px;
      vertical-align: top;
      border: 1px solid #BBDEFB;
      font-size: 9.5px;
      line-height: 1.55;
      word-wrap: break-word;
      overflow-wrap: break-word;
      color: #2a2a2a;
    }
    tr:nth-child(odd)  td.food { background: #ffffff; }
    tr:nth-child(even) td.food { background: #EBF5FF; }
    td.food:last-child { border-right: none; }

    /* ── Footer ── */
    .footer {
      text-align: center;
      margin-top: 6px;
      font-size: 8px;
      color: #999;
      letter-spacing: 0.4px;
    }
    .footer span { color: #1565C0; font-weight: 600; }
  </style>
</head>
<body>
  <img src="${topRightDecoUrl}" class="deco deco-tr" alt="" />
  <img src="${bottomDecoUrl}"   class="deco deco-bl" alt="" />

  <div class="header">
    <img src="${logoDataUrl}" class="header-logo" alt="Logo" />
    <div class="header-center">
      <h1>${escHtml(title)}</h1>
      <div class="subtitle">Personalized Nutrition Plan &nbsp;·&nbsp; From Monday</div>
      <div class="date-line"><b>Date:</b> ${getRange()} &nbsp;&nbsp; <b>Duration:</b> ${planData.editableDayCount || dayGroups.length} days</div>
    </div>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="corner"></th>
          ${colHeaders.map(h => `<th class="day">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${bodyRows.map(row => `
          <tr>
            <td class="meal-label">${escHtml(row.period)}${row.time ? `<div class="meal-time">${escHtml(row.time)}</div>` : ''}</td>
            ${row.cells.map(c => `<td class="food">${c}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">© ${new Date().getFullYear()} <span>From Monday</span> — Dr. Aamit Shah &nbsp;·&nbsp; Personalized Diet &amp; Nutrition Plan &nbsp;·&nbsp; Confidential</div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(content);
      win.document.title = title;
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const generateImportantNotesPDF = async (plan: any) => {
    if (!plan.is_ai_generated || !plan.ai_plan_data) {
      toast.error('Only AI-generated plans support this export');
      return;
    }
    const planData = plan.ai_plan_data;
    const importantNotes: string[] = planData.importantNotes || [];
    if (!importantNotes.length) {
      toast.error('No important notes found in this plan');
      return;
    }

    const client = plan.clients;

    let logoDataUrl = '';
    try {
      const res = await fetch('/clinic-logo.png');
      const blob = await res.blob();
      logoDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (_) {}

    const planDisplayName = (planData.planName || plan.plan_name || '').replace(/food plan/gi, 'Lifestyle Plan');

    const fmtDate = (d: string) => {
      if (!d) return '';
      try {
        const dt = new Date(d);
        return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`;
      } catch { return d; }
    };
    const getRange = () => {
      const s = planData.editableStartDate || planData.startDate || '';
      if (!s) return 'N/A';
      try {
        const start = new Date(s);
        const days = parseInt(planData.editableDayCount || String(planData.dayGroups?.length || 7));
        const end = new Date(start); end.setDate(start.getDate() + days - 1);
        return `${fmtDate(s)} to ${fmtDate(end.toISOString().split('T')[0])}`;
      } catch { return s; }
    };

    const clientName = client?.name || plan.plan_name || 'Client';
    const clientAge = client?.date_of_birth
      ? (() => {
          const b = new Date(client.date_of_birth);
          const today = new Date();
          let age = today.getFullYear() - b.getFullYear();
          if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--;
          return `${age} years`;
        })()
      : 'Not specified';

    const content = `<!DOCTYPE html>
<html>
<head>
  <title>Important Notes — ${clientName}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 14mm 18mm 18mm 18mm; color: #333; font-size: 11px; line-height: 1.5; }
    .header { display: flex; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #1F5CA0; padding-bottom: 12px; }
    .header-logo { width: 110px; height: auto; flex-shrink: 0; }
    .header-title { flex: 1; text-align: center; }
    .header h1 { color: #1F5CA0; font-size: 20px; margin: 0; }
    .header h2 { color: #555; font-size: 13px; font-weight: 400; margin-top: 4px; }
    .client-details { background: #EDF3FA; border: 1px solid #D1DCE8; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; }
    .client-details h3 { color: #1F5CA0; font-size: 13px; margin-bottom: 10px; font-weight: 700; }
    .client-details-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; font-size: 10.5px; }
    .client-details-grid div { margin-bottom: 2px; }
    .client-details-grid span { font-weight: 700; color: #1F5CA0; }
    .notes-section { background: #fff8e1; border: 2px solid #f0a500; border-radius: 8px; padding: 16px 20px; }
    .notes-section h3 { color: #7a4f00; font-size: 15px; font-weight: 800; margin-bottom: 14px; letter-spacing: 0.3px; border-bottom: 1px solid #f0c040; padding-bottom: 8px; }
    .notes-section ol { padding-left: 20px; }
    .notes-section li { margin-bottom: 10px; font-size: 12px; font-weight: 500; color: #3a2800; line-height: 1.6; }
    .notes-section li::marker { font-weight: 700; color: #7a4f00; }
    strong { font-weight: bold !important; }
    em { font-style: italic !important; }
    .footer { text-align: center; margin-top: 24px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 9px; color: #aaa; }
  </style>
</head>
<body>
  <div class="header">
    <img src="${logoDataUrl}" alt="Clinic Logo" class="header-logo" />
    <div class="header-title">
      <h1>Important Notes</h1>
      <h2>${planDisplayName}</h2>
    </div>
  </div>

  <div class="client-details">
    <h3>📋 Client Details</h3>
    <div class="client-details-grid">
      <div><span>Name:</span> ${clientName}</div>
      <div><span>Age:</span> ${clientAge}</div>
      <div><span>Gender:</span> ${client?.gender || 'Not specified'}</div>
      <div><span>Height / Weight:</span> ${client?.height || '--'} cm / ${client?.weight || '--'} kg</div>
      <div><span>Goal:</span> ${client?.goal || 'Not specified'}</div>
      <div><span>Diet Preference:</span> ${client?.diet_preference || 'Not specified'}</div>
      <div><span>Skin Type:</span> ${client?.skin_type || 'Not specified'}</div>
      <div><span>Hair Type:</span> ${client?.hair_type || 'Not specified'}</div>
      <div><span>Plan Period:</span> ${getRange()}</div>
    </div>
  </div>

  <div class="notes-section">
    <h3>⚠️ Important Dietary Notes</h3>
    <ol>
      ${importantNotes.map(note => `<li>${note}</li>`).join('\n      ')}
    </ol>
  </div>

  <div class="footer">
    © ${new Date().getFullYear()} From Monday — Dr. Aamit Shah. This lifestyle plan is personalized and should be followed as advised.
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(content);
      win.document.title = `Important Notes — ${clientName}`;
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  // Utility function to calculate age
  const calculateAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return 0;
    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime())) return 0;
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
                  <Button variant="outline" size="sm" onClick={() => handleDownloadPDF(plan)} title="Download detailed PDF">
                    <Download className="h-4 w-4" />
                  </Button>
                  {plan.is_ai_generated && plan.ai_plan_data && (
                    <Button variant="outline" size="sm" onClick={() => generateOnePagerPDF(plan)} title="Download one-pager PDF">
                      <FileSpreadsheet className="h-4 w-4" />
                    </Button>
                  )}
                  {plan.is_ai_generated && plan.ai_plan_data?.importantNotes?.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => generateImportantNotesPDF(plan)} title="Download important notes PDF" className="border-amber-400 text-amber-700 hover:bg-amber-50">
                      <StickyNote className="h-4 w-4" />
                    </Button>
                  )}
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
                  <TableHead>Lifestyle Plan</TableHead>
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

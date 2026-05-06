import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Home, ChevronRight, Upload, Database, Pencil, Trash2, Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

type Row = {
  meal_name: string;
  recipe_text: string;
  meal_name_normalized: string;
  status: 'valid' | 'invalid' | 'duplicate-in-file';
  error?: string;
};

type Recipe = {
  id: string;
  meal_name: string;
  meal_name_normalized: string;
  recipe_text: string;
  created_at: string;
};

const normalize = (s: string) =>
  (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

const MealRecipesImport = () => {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

  // Manage state
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [editName, setEditName] = useState('');
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const loadRecipes = async () => {
    setLoadingRecipes(true);
    try {
      const { data, error } = await supabase
        .from('meal_recipes')
        .select('*')
        .order('meal_name', { ascending: true });
      if (error) throw error;
      setRecipes((data || []) as Recipe[]);
    } catch (e: any) {
      toast.error(`Failed to load recipes: ${e.message}`);
    } finally {
      setLoadingRecipes(false);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  const processRows = (raw: Array<Record<string, any>>) => {
    const seen = new Set<string>();
    const parsed: Row[] = raw.map((r) => {
      const meal_name = String(r.meal_name ?? r['Meal Name'] ?? r.MealName ?? '').trim();
      const recipe_text = String(r.recipe_text ?? r['Recipe Text'] ?? r.RecipeText ?? '').trim();
      const norm = normalize(meal_name);

      if (!meal_name || !recipe_text) {
        return { meal_name, recipe_text, meal_name_normalized: norm, status: 'invalid', error: 'Missing meal_name or recipe_text' };
      }
      if (seen.has(norm)) {
        return { meal_name, recipe_text, meal_name_normalized: norm, status: 'duplicate-in-file' };
      }
      seen.add(norm);
      return { meal_name, recipe_text, meal_name_normalized: norm, status: 'valid' };
    });
    setRows(parsed);
    setResult(null);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();
    try {
      if (ext === 'csv') {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (res) => processRows(res.data as any[]),
          error: (err) => toast.error(`CSV parse error: ${err.message}`),
        });
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
        processRows(json);
      } else {
        toast.error('Unsupported file type. Use CSV or Excel.');
      }
    } catch (e: any) {
      toast.error(`Failed to read file: ${e.message}`);
    }
  };

  const handleImport = async () => {
    const valid = rows.filter((r) => r.status === 'valid');
    if (valid.length === 0) {
      toast.error('No valid rows to import');
      return;
    }
    setImporting(true);
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('meal_recipes')
        .select('meal_name_normalized');
      if (fetchErr) throw fetchErr;

      const existingSet = new Set((existing || []).map((e: any) => e.meal_name_normalized));
      const toInsert = valid.filter((r) => !existingSet.has(r.meal_name_normalized));
      const skipped = valid.length - toInsert.length;

      if (toInsert.length === 0) {
        setResult({ inserted: 0, skipped });
        toast.info(`All ${skipped} rows already exist. Nothing inserted.`);
        return;
      }

      const payload = toInsert.map((r) => ({
        meal_name: r.meal_name,
        meal_name_normalized: r.meal_name_normalized,
        recipe_text: r.recipe_text,
      }));

      let inserted = 0;
      for (let i = 0; i < payload.length; i += 500) {
        const chunk = payload.slice(i, i + 500);
        const { error } = await supabase.from('meal_recipes').insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }

      setResult({ inserted, skipped });
      toast.success(`Inserted ${inserted} recipes. Skipped ${skipped} duplicates.`);
      await loadRecipes();
    } catch (e: any) {
      toast.error(`Import failed: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  const openEdit = (r: Recipe) => {
    setEditing(r);
    setEditName(r.meal_name);
    setEditText(r.recipe_text);
  };

  const openAdd = () => {
    setEditing(null);
    setEditName('');
    setEditText('');
    setAddOpen(true);
  };

  const handleSave = async () => {
    const name = editName.trim();
    const text = editText.trim();
    if (!name || !text) {
      toast.error('Meal name and recipe text are required');
      return;
    }
    const norm = normalize(name);
    if (!norm) {
      toast.error('Meal name must contain alphanumeric characters');
      return;
    }
    setSaving(true);
    try {
      // Check duplicate normalized (excluding current editing row)
      const { data: dup, error: dupErr } = await supabase
        .from('meal_recipes')
        .select('id')
        .eq('meal_name_normalized', norm)
        .maybeSingle();
      if (dupErr && dupErr.code !== 'PGRST116') throw dupErr;
      if (dup && (!editing || dup.id !== editing.id)) {
        toast.error('Another recipe with the same normalized name already exists');
        setSaving(false);
        return;
      }

      if (editing) {
        const { error } = await supabase
          .from('meal_recipes')
          .update({ meal_name: name, meal_name_normalized: norm, recipe_text: text })
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Recipe updated');
      } else {
        const { error } = await supabase
          .from('meal_recipes')
          .insert({ meal_name: name, meal_name_normalized: norm, recipe_text: text });
        if (error) throw error;
        toast.success('Recipe added');
      }
      setEditing(null);
      setAddOpen(false);
      await loadRecipes();
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { error } = await supabase.from('meal_recipes').delete().eq('id', deletingId);
      if (error) throw error;
      toast.success('Recipe deleted');
      setDeletingId(null);
      await loadRecipes();
    } catch (e: any) {
      toast.error(`Delete failed: ${e.message}`);
    }
  };

  const validCount = rows.filter((r) => r.status === 'valid').length;
  const invalidCount = rows.filter((r) => r.status === 'invalid').length;
  const dupCount = rows.filter((r) => r.status === 'duplicate-in-file').length;

  const filteredRecipes = recipes.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return r.meal_name.toLowerCase().includes(q) || r.recipe_text.toLowerCase().includes(q);
  });

  const dialogOpen = !!editing || addOpen;

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Meal Recipes</span>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        <Database className="h-6 w-6" /> Meal Recipes Manager
      </h1>

      <Card className="p-6 mb-6 shadow-card">
        <h2 className="text-lg font-semibold mb-3">Bulk Import</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="file">Upload CSV or Excel file</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Required columns: <code>meal_name</code>, <code>recipe_text</code>. The <code>meal_name_normalized</code> field is generated automatically.
            </p>
            <Input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
          {fileName && (
            <p className="text-sm text-muted-foreground">Loaded: <strong>{fileName}</strong></p>
          )}
        </div>
      </Card>

      {rows.length > 0 && (
        <Card className="p-6 mb-6 shadow-card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="default">{validCount} valid</Badge>
              {dupCount > 0 && <Badge variant="secondary">{dupCount} duplicate in file</Badge>}
              {invalidCount > 0 && <Badge variant="destructive">{invalidCount} invalid</Badge>}
            </div>
            <Button onClick={handleImport} disabled={importing || validCount === 0}>
              <Upload className="h-4 w-4 mr-2" />
              {importing ? 'Importing...' : `Import ${validCount} rows`}
            </Button>
          </div>

          {result && (
            <div className="mb-4 p-3 rounded bg-muted text-sm">
              ✅ Inserted: <strong>{result.inserted}</strong> · Skipped (already in DB): <strong>{result.skipped}</strong>
            </div>
          )}

          <div className="max-h-[400px] overflow-auto border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Meal Name</TableHead>
                  <TableHead>Normalized</TableHead>
                  <TableHead>Recipe (preview)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{r.meal_name || <em className="text-muted-foreground">empty</em>}</TableCell>
                    <TableCell className="font-mono text-xs">{r.meal_name_normalized}</TableCell>
                    <TableCell className="max-w-md truncate">{r.recipe_text}</TableCell>
                    <TableCell>
                      {r.status === 'valid' && <Badge variant="default">Valid</Badge>}
                      {r.status === 'duplicate-in-file' && <Badge variant="secondary">Dup in file</Badge>}
                      {r.status === 'invalid' && (
                        <Badge variant="destructive" title={r.error}>Invalid</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Manage existing recipes */}
      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold">Existing Recipes</h2>
            <p className="text-sm text-muted-foreground">
              {loadingRecipes ? 'Loading...' : `${recipes.length} total`}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search meals or recipe text..."
                className="pl-8 w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" /> Add Recipe
            </Button>
          </div>
        </div>

        <div className="max-h-[600px] overflow-auto border rounded">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meal Name</TableHead>
                <TableHead>Normalized</TableHead>
                <TableHead>Recipe (preview)</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecipes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {loadingRecipes ? 'Loading...' : 'No recipes found'}
                  </TableCell>
                </TableRow>
              )}
              {filteredRecipes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.meal_name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.meal_name_normalized}</TableCell>
                  <TableCell className="max-w-md truncate">{r.recipe_text}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeletingId(r.id)} title="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit / Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setEditing(null); setAddOpen(false); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Recipe' : 'Add Recipe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="meal_name">Meal Name</Label>
              <Input
                id="meal_name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Paneer Bhurji"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Normalized: <code>{normalize(editName) || '—'}</code>
              </p>
            </div>
            <div>
              <Label htmlFor="recipe_text">Recipe</Label>
              <Textarea
                id="recipe_text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Ingredients and steps..."
                rows={12}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setAddOpen(false); }} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => { if (!o) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete recipe?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the recipe from the master list. Diet plan PDFs generated after this will no longer include it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default MealRecipesImport;

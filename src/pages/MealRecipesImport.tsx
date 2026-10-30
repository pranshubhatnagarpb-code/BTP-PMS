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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Home, ChevronRight, Upload, Database, Pencil, Trash2, Plus, Search, Youtube } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllMealRecipes, stripLeadingQuantity } from '@/lib/mealRecipes';
import { toast } from 'sonner';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parseRecipeLinksDocx, type RecipeLinkEntry } from '@/lib/recipeLinksDocx';

type Row = {
  Meal_name: string;
  Ingredients: string;
  Instructions: string;
  Remarks: string;
  meal_name_normalized: string;
  status: 'valid' | 'invalid' | 'duplicate-in-file';
  error?: string;
};

type Recipe = {
  id: string;
  Meal_name: string;
  Ingredients: string;
  Instructions: string;
  Remarks: string;
  meal_name_normalized: string;
  recipe_links: string[] | null;
  category: string | null;
  created_at: string;
};

const normalize = (s: string) =>
  (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '').trim();

const parseLinks = (text: string) =>
  [...new Set(text.split(/\s+/).map((l) => l.trim()).filter((l) => /^https?:\/\/\S+$/i.test(l)))];

// Same dish listed twice in the document -> one entry with both links.
const mergeLinkEntries = (entries: RecipeLinkEntry[]) => {
  const byName = new Map<string, RecipeLinkEntry>();
  entries.forEach((e) => {
    const key = normalize(e.name);
    if (!key) return;
    const prev = byName.get(key);
    if (prev) prev.links = [...new Set([...prev.links, ...e.links])];
    else byName.set(key, { ...e, links: [...e.links] });
  });
  return [...byName.values()];
};

const getCell = (row: Record<string, any>, keys: string[]) => {
  const normalizedMap = Object.entries(row).reduce<Record<string, any>>((acc, [key, value]) => {
    acc[key.toLowerCase().replace(/[^a-z0-9]+/g, '')] = value;
    return acc;
  }, {});

  for (const key of keys) {
    const direct = row[key];
    if (direct !== undefined && direct !== null) return String(direct).trim();
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '');
    const loose = normalizedMap[normalizedKey];
    if (loose !== undefined && loose !== null) return String(loose).trim();
  }
  return '';
};

const MealRecipesImport = () => {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [editName, setEditName] = useState('');
  const [editIngredients, setEditIngredients] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editLinks, setEditLinks] = useState('');

  const [linksFileName, setLinksFileName] = useState('');
  const [linkEntries, setLinkEntries] = useState<RecipeLinkEntry[]>([]);
  const [importingLinks, setImportingLinks] = useState(false);
  const [linksResult, setLinksResult] = useState<{ added: number; updated: number; unchanged: number } | null>(null);

  const loadRecipes = async () => {
    setLoadingRecipes(true);
    try {
      setRecipes(await fetchAllMealRecipes<Recipe>('*'));
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
      const Meal_name = stripLeadingQuantity(getCell(r, ['Meal_name', 'meal_name', 'Meal Name', 'MealName']));
      const Ingredients = getCell(r, ['Ingredients', 'ingredients']);
      const Instructions = getCell(r, ['Instructions', 'instructions', 'recipe_text', 'Recipe Text', 'RecipeText']);
      const Remarks = getCell(r, ['Remarks', 'remarks']);
      const norm = normalize(Meal_name);

      if (!Meal_name || !Instructions) {
        return { Meal_name, Ingredients, Instructions, Remarks, meal_name_normalized: norm, status: 'invalid', error: 'Missing Meal_name or Instructions' };
      }
      if (!norm) {
        return { Meal_name, Ingredients, Instructions, Remarks, meal_name_normalized: norm, status: 'invalid', error: 'Meal_name must contain alphanumeric characters' };
      }
      if (seen.has(norm)) {
        return { Meal_name, Ingredients, Instructions, Remarks, meal_name_normalized: norm, status: 'duplicate-in-file' };
      }
      seen.add(norm);
      return { Meal_name, Ingredients, Instructions, Remarks, meal_name_normalized: norm, status: 'valid' };
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
      const existing = await fetchAllMealRecipes<{ meal_name_normalized: string }>('meal_name_normalized');

      const existingSet = new Set((existing || []).map((e: any) => e.meal_name_normalized));
      const toInsert = valid.filter((r) => !existingSet.has(r.meal_name_normalized));
      const skipped = valid.length - toInsert.length;

      if (toInsert.length === 0) {
        setResult({ inserted: 0, skipped });
        toast.info(`All ${skipped} rows already exist. Nothing inserted.`);
        return;
      }

      const payload = toInsert.map((r) => ({
        Meal_name: r.Meal_name,
        Ingredients: r.Ingredients,
        Instructions: r.Instructions,
        Remarks: r.Remarks,
        meal_name_normalized: r.meal_name_normalized,
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

  const handleLinksFile = async (file: File) => {
    setLinksFileName(file.name);
    setLinksResult(null);
    try {
      const entries = mergeLinkEntries(
        parseRecipeLinksDocx(new Uint8Array(await file.arrayBuffer())).map((e) => ({ ...e, name: stripLeadingQuantity(e.name) })),
      );
      if (!entries.length) toast.error('No recipe links found in this document');
      setLinkEntries(entries);
    } catch (e: any) {
      setLinkEntries([]);
      toast.error(`Failed to read document: ${e.message}`);
    }
  };

  // New dishes are added as link-only recipes; dishes already in the bank keep
  // their written recipe and gain any new links.
  const handleLinksImport = async () => {
    if (!linkEntries.length) return;
    setImportingLinks(true);
    try {
      // Every existing dish, so none is mistaken for new (and blanked by the upsert).
      const existing = await fetchAllMealRecipes<{
        Meal_name: string;
        meal_name_normalized: string;
        Ingredients: string;
        Instructions: string;
        Remarks: string;
        recipe_links: string[] | null;
        category: string | null;
      }>('Meal_name, meal_name_normalized, Ingredients, Instructions, Remarks, recipe_links, category');
      const byNorm = new Map((existing || []).map((r) => [r.meal_name_normalized, r]));

      let added = 0;
      let updated = 0;
      let unchanged = 0;
      const rowsToSave = linkEntries.flatMap((e) => {
        const norm = normalize(e.name);
        const current = byNorm.get(norm);
        if (!current) {
          added++;
          return [{
            Meal_name: e.name,
            meal_name_normalized: norm,
            Ingredients: '',
            Instructions: '',
            Remarks: '',
            recipe_links: e.links,
            category: e.category || null,
          }];
        }
        const links = [...new Set([...(current.recipe_links || []), ...e.links])];
        if (links.length === (current.recipe_links || []).length && (current.category || !e.category)) {
          unchanged++;
          return [];
        }
        updated++;
        return [{
          ...current,
          recipe_links: links,
          category: current.category || e.category || null,
        }];
      });

      for (let i = 0; i < rowsToSave.length; i += 500) {
        const { error } = await supabase
          .from('meal_recipes')
          .upsert(rowsToSave.slice(i, i + 500), { onConflict: 'meal_name_normalized' });
        if (error) throw error;
      }

      setLinksResult({ added, updated, unchanged });
      toast.success(`Recipe links imported: ${added} new dishes, ${updated} updated.`);
      await loadRecipes();
    } catch (e: any) {
      toast.error(`Import failed: ${e.message}`);
    } finally {
      setImportingLinks(false);
    }
  };

  const openEdit = (r: Recipe) => {
    setEditing(r);
    setEditName(r.Meal_name);
    setEditIngredients(r.Ingredients || '');
    setEditInstructions(r.Instructions || '');
    setEditRemarks(r.Remarks || '');
    setEditLinks((r.recipe_links || []).join('\n'));
  };

  const openAdd = () => {
    setEditing(null);
    setEditName('');
    setEditIngredients('');
    setEditInstructions('');
    setEditRemarks('');
    setEditLinks('');
    setAddOpen(true);
  };

  const handleSave = async () => {
    const name = editName.trim();
    const ingredients = editIngredients.trim();
    const instructions = editInstructions.trim();
    const remarks = editRemarks.trim();
    const links = parseLinks(editLinks);
    if (!name || (!instructions && !links.length)) {
      toast.error('Meal name and either instructions or a recipe link are required');
      return;
    }
    const norm = normalize(name);
    if (!norm) {
      toast.error('Meal name must contain alphanumeric characters');
      return;
    }
    setSaving(true);
    try {
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
          .update({ Meal_name: name, Ingredients: ingredients, Instructions: instructions, Remarks: remarks, recipe_links: links, meal_name_normalized: norm })
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Recipe updated');
      } else {
        const { error } = await supabase
          .from('meal_recipes')
          .insert({ Meal_name: name, Ingredients: ingredients, Instructions: instructions, Remarks: remarks, recipe_links: links, meal_name_normalized: norm });
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
    return [r.Meal_name, r.Ingredients, r.Instructions, r.Remarks, r.category, ...(r.recipe_links || [])]
      .some((value) => (value || '').toLowerCase().includes(q));
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
              Required columns: <code>Meal_name</code>, <code>Instructions</code>. Optional columns: <code>Ingredients</code>, <code>Remarks</code>. The <code>meal_name_normalized</code> field is generated automatically.
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

      <Card className="p-6 mb-6 shadow-card">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Youtube className="h-5 w-5" /> Import Recipe Links
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          Upload the clinic's recipe links Word document (.docx). Each dish line with a YouTube / Instagram link is added
          to the recipe bank; dishes already in the bank keep their written recipe and get the new links. Diet plan PDFs
          list these links for every dish they mention.
        </p>
        <Input
          type="file"
          accept=".docx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleLinksFile(f);
          }}
        />
        {linksFileName && linkEntries.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm">
                <strong>{linksFileName}</strong>: {linkEntries.length} dishes,{' '}
                {linkEntries.reduce((n, e) => n + e.links.length, 0)} links
              </p>
              <Button onClick={handleLinksImport} disabled={importingLinks}>
                <Upload className="h-4 w-4 mr-2" />
                {importingLinks ? 'Importing...' : `Import ${linkEntries.length} dishes`}
              </Button>
            </div>
            {linksResult && (
              <div className="p-3 rounded bg-muted text-sm">
                ✅ New dishes: <strong>{linksResult.added}</strong> · Links added to existing:{' '}
                <strong>{linksResult.updated}</strong> · Already up to date: <strong>{linksResult.unchanged}</strong>
              </div>
            )}
            <div className="max-h-[400px] overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dish</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Links</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkEntries.map((e) => (
                    <TableRow key={e.name}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell className="text-muted-foreground">{e.category || '-'}</TableCell>
                      <TableCell className="text-xs">
                        {e.links.map((l) => (
                          <a key={l} href={l} target="_blank" rel="noreferrer" className="block max-w-xs truncate text-primary hover:underline">
                            {l}
                          </a>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
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
                  <TableHead>Ingredients</TableHead>
                  <TableHead>Instructions</TableHead>
                  <TableHead>Remarks</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{r.Meal_name || <em className="text-muted-foreground">empty</em>}</TableCell>
                    <TableCell className="font-mono text-xs">{r.meal_name_normalized}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.Ingredients || '-'}</TableCell>
                    <TableCell className="max-w-md truncate">{r.Instructions}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.Remarks || '-'}</TableCell>
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

      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold">Existing Recipes</h2>
            <p className="text-sm text-muted-foreground">
              {loadingRecipes ? 'Loading...' : `${recipes.length} total`}
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search recipes..."
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
                <TableHead>Ingredients</TableHead>
                <TableHead>Instructions</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Links</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecipes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {loadingRecipes ? 'Loading...' : 'No recipes found'}
                  </TableCell>
                </TableRow>
              )}
              {filteredRecipes.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.Meal_name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.meal_name_normalized}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.Ingredients || '-'}</TableCell>
                  <TableCell className="max-w-md truncate">{r.Instructions || '-'}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.Remarks || '-'}</TableCell>
                  <TableCell>
                    {r.recipe_links?.length ? (
                      <a href={r.recipe_links[0]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline text-sm">
                        <Youtube className="h-4 w-4" />
                        {r.recipe_links.length > 1 ? `${r.recipe_links.length} links` : 'Watch'}
                      </a>
                    ) : '-'}
                  </TableCell>
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

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setEditing(null); setAddOpen(false); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Recipe' : 'Add Recipe'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="Meal_name">Meal Name</Label>
              <Input
                id="Meal_name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Paneer Bhurji"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Normalized: <code>{normalize(editName) || '—'}</code>
              </p>
            </div>
            <div>
              <Label htmlFor="Ingredients">Ingredients</Label>
              <Textarea
                id="Ingredients"
                value={editIngredients}
                onChange={(e) => setEditIngredients(e.target.value)}
                placeholder="Ingredients list..."
                rows={5}
              />
            </div>
            <div>
              <Label htmlFor="Instructions">Instructions</Label>
              <Textarea
                id="Instructions"
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                placeholder="Preparation steps..."
                rows={8}
              />
            </div>
            <div>
              <Label htmlFor="Remarks">Remarks</Label>
              <Textarea
                id="Remarks"
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                placeholder="Optional notes, substitutions, serving tips..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="RecipeLinks">Recipe video links</Label>
              <Textarea
                id="RecipeLinks"
                value={editLinks}
                onChange={(e) => setEditLinks(e.target.value)}
                placeholder="One YouTube / Instagram link per line"
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Instructions or at least one link is required. Links appear in the diet plan PDF's recipe section.
              </p>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <Button variant="outline" onClick={() => { setEditing(null); setAddOpen(false); }} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

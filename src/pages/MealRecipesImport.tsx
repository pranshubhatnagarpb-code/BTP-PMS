import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Home, ChevronRight, Upload, Database } from 'lucide-react';
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

const normalize = (s: string) =>
  (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

const MealRecipesImport = () => {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);

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
      // Fetch existing normalized names to skip duplicates
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

      // Insert in chunks of 500
      let inserted = 0;
      for (let i = 0; i < payload.length; i += 500) {
        const chunk = payload.slice(i, i + 500);
        const { error } = await supabase.from('meal_recipes').insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }

      setResult({ inserted, skipped });
      toast.success(`Inserted ${inserted} recipes. Skipped ${skipped} duplicates.`);
    } catch (e: any) {
      toast.error(`Import failed: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  const validCount = rows.filter((r) => r.status === 'valid').length;
  const invalidCount = rows.filter((r) => r.status === 'invalid').length;
  const dupCount = rows.filter((r) => r.status === 'duplicate-in-file').length;

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Meal Recipes Import</span>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
        <Database className="h-6 w-6" /> Meal Recipes Bulk Import
      </h1>

      <Card className="p-6 mb-6 shadow-card">
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

          <div className="max-h-[500px] overflow-auto border rounded">
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
    </DashboardLayout>
  );
};

export default MealRecipesImport;

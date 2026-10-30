// Turn an existing diet plan (PDF or Word, e.g. a plan made before the PMS) into
// a template, without AI: the plan's table is read straight from the file.
import { useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateTemplate, type TemplateDay } from '@/hooks/useDietChartTemplates';
import type { ImportedTemplate } from '@/lib/planPdfImport';

export interface ImportedTemplateDraft {
  name: string;
  category: string;
  instructions: string;
  days: TemplateDay[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  /** Opens the import in the template editor (not yet saved). */
  onEdit: (draft: ImportedTemplateDraft) => void;
}

// "Session 21_8- Komal.pdf" -> "Session 21 8 - Komal"
const nameFromFile = (fileName: string) =>
  fileName.replace(/\.(pdf|docx)$/i, '').replace(/_+/g, ' ').replace(/\s*-\s*/g, ' - ').replace(/\s+/g, ' ').trim();

const readPlan = async (file: File): Promise<ImportedTemplate> => {
  if (/\.docx$/i.test(file.name)) {
    const { parsePlanDocx } = await import('@/lib/planDocxImport');
    return parsePlanDocx(file);
  }
  const { readPdfFile, parsePlanPdf } = await import('@/lib/planPdfImport');
  return parsePlanPdf(await readPdfFile(file));
};

export const ImportPlanTemplateDialog = ({ open, onOpenChange, categories, onEdit }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportedTemplate | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General Wellness');
  const createTemplate = useCreateTemplate();

  const reset = () => {
    setFileName('');
    setResult(null);
    setName('');
    setCategory('General Wellness');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (/\.doc$/i.test(file.name)) {
      toast.error('Old Word (.doc) files can’t be read', { description: 'Save it as .docx or PDF in Word, then import that.' });
      return;
    }
    setReading(true);
    setResult(null);
    setFileName(file.name);
    try {
      const imported = await readPlan(file);
      if (!imported.mealCount) {
        toast.error('No diet table found in this file', {
          description: 'It needs a table with a MENU column (MEAL TYPE / TIME / MENU, or one table per day).',
        });
        return;
      }
      setResult(imported);
      setName(nameFromFile(file.name));
    } catch (e) {
      toast.error('Could not read this file', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setReading(false);
    }
  };

  const draft = (): ImportedTemplateDraft | null =>
    result ? { name: name.trim() || nameFromFile(fileName), category, instructions: result.instructions, days: result.days } : null;

  const save = () => {
    const d = draft();
    if (!d) return;
    createTemplate.mutate(
      { name: d.name, category: d.category, instructions: d.instructions, template_data: d.days },
      { onSuccess: () => handleOpenChange(false) },
    );
  };

  const edit = () => {
    const d = draft();
    if (!d) return;
    handleOpenChange(false);
    onEdit(d);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Import template from a diet plan</DialogTitle>
          <DialogDescription>
            Choose a diet plan that's already been made, as a PDF or Word (.docx) file. Its meals, times, options, notes and
            "Things to remember" are copied into a new template. No AI is used.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <Button variant="outline" className="w-full justify-start" disabled={reading} onClick={() => inputRef.current?.click()}>
            {reading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
            <span className="truncate">{reading ? `Reading ${fileName}…` : fileName || 'Choose PDF or Word file'}</span>
          </Button>

          {result && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="import-name">Template name</Label>
                  <Input id="import-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md border">
                <div className="border-b bg-muted/50 px-3 py-2 text-sm font-medium">
                  Found {result.mealCount} meal{result.mealCount === 1 ? '' : 's'}
                  {result.days.length > 1 ? ` across ${result.days.length} days` : ''}
                </div>
                <div className="max-h-[40vh] divide-y overflow-y-auto text-sm">
                  {result.days.map((day, di) => (
                    <div key={di}>
                      {result.days.length > 1 && <div className="bg-muted/30 px-3 py-1.5 text-xs font-semibold uppercase">{day.day}</div>}
                      {day.meals.map((m, mi) => (
                        <div key={mi} className="grid grid-cols-[120px_1fr] gap-3 px-3 py-2">
                          <div>
                            <div className="font-medium">{m.time}</div>
                            {m.clock && <div className="text-xs text-muted-foreground">{m.clock}</div>}
                          </div>
                          <div className="min-w-0">
                            <p className="line-clamp-3 whitespace-pre-line">{m.meal}</p>
                            {m.notes && <p className="mt-1 line-clamp-2 text-xs italic text-muted-foreground">Note: {m.notes}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {result.instructions && (
                <div className="space-y-1">
                  <Label>Things to remember (template instructions)</Label>
                  <p className="whitespace-pre-line rounded-md border bg-muted/30 px-3 py-2 text-sm">{result.instructions}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                The walk-after-meal and "avoid fried snacks" reminders aren't copied, because every plan adds them automatically.
              </p>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button variant="outline" disabled={!result} onClick={edit}>Review in editor</Button>
          <Button className="gradient-primary text-primary-foreground" disabled={!result || createTemplate.isPending} onClick={save}>
            {createTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

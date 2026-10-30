// Diet guidelines library: import Word documents (e.g. "Hives & Psoriasis"),
// which diet plans (AI or manual) can append to their PDF.
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronRight, Eye, FileText, Home, Loader2, Pencil, ScrollText, Trash2, Upload, X } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { GuidelineContent } from '@/components/diet/GuidelineContent';
import {
  useDeleteDietGuideline,
  useDietGuidelines,
  useImportDietGuidelines,
  useRenameDietGuideline,
  type DietGuideline,
} from '@/hooks/useDietGuidelines';
import { docxToGuidelineHtml, guidelineTitleFromFile } from '@/lib/dietGuidelines';

interface PendingImport {
  key: string;
  fileName: string;
  title: string;
  html: string;
}

const DietGuidelines = () => {
  const { guidelines, isLoading, tableMissing } = useDietGuidelines();
  const importGuidelines = useImportDietGuidelines();
  const renameGuideline = useRenameDietGuideline();
  const deleteGuideline = useDeleteDietGuideline();

  const [pending, setPending] = useState<PendingImport[]>([]);
  const [converting, setConverting] = useState(false);
  const [viewing, setViewing] = useState<{ title: string; html: string } | null>(null);
  const [renaming, setRenaming] = useState<DietGuideline | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<DietGuideline | null>(null);

  const handleFiles = async (files: FileList | null) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    setConverting(true);
    const converted: PendingImport[] = [];
    for (const file of list) {
      if (!/\.docx$/i.test(file.name)) {
        toast.error(`${file.name}: only Word .docx files can be imported`);
        continue;
      }
      try {
        const html = await docxToGuidelineHtml(file);
        if (!html) {
          toast.error(`${file.name}: no content found`);
          continue;
        }
        converted.push({ key: `${file.name}-${Math.random()}`, fileName: file.name, title: guidelineTitleFromFile(file.name), html });
      } catch (e) {
        toast.error(`${file.name}: could not read the document`, { description: e instanceof Error ? e.message : undefined });
      }
    }
    setPending((p) => [...p, ...converted]);
    setConverting(false);
  };

  const importPending = () => {
    if (pending.some((p) => !p.title.trim())) {
      toast.error('Give every guideline a title');
      return;
    }
    importGuidelines.mutate(
      pending.map((p) => ({ title: p.title.trim(), content_html: p.html, file_name: p.fileName })),
      { onSuccess: () => setPending([]) },
    );
  };

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Diet Guidelines</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <ScrollText className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diet Guidelines</h1>
          <p className="text-sm text-muted-foreground">
            Condition guidelines imported from Word, to append to AI or manual diet plans.
          </p>
        </div>
      </div>

      {tableMissing && (
        <Card className="p-4 mb-6 text-sm text-muted-foreground">
          Run the <code>diet_guidelines</code> database migration to use this section.
        </Card>
      )}

      <Card className="p-6 mb-6 shadow-card">
        <h2 className="text-lg font-semibold mb-1">Import guidelines</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Choose one or more Word documents (.docx). Headings, bold text, bullet points and tables are kept; the letterhead is
          left out, since the plan already prints it.
        </p>
        <div className="flex items-center gap-3">
          <Input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
            disabled={tableMissing || converting}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
            className="max-w-md"
          />
          {converting && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {pending.length > 0 && (
          <div className="mt-4 space-y-2">
            {pending.map((p) => (
              <div key={p.key} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Input
                  value={p.title}
                  onChange={(e) => setPending((list) => list.map((x) => (x.key === p.key ? { ...x, title: e.target.value } : x)))}
                  className="h-8 min-w-[200px] flex-1"
                  aria-label="Guideline title"
                />
                <span className="text-xs text-muted-foreground">{p.fileName}</span>
                <Button size="sm" variant="ghost" onClick={() => setViewing({ title: p.title, html: p.html })}>
                  <Eye className="h-4 w-4 mr-1" /> Preview
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground"
                  onClick={() => setPending((list) => list.filter((x) => x.key !== p.key))}
                  aria-label="Don't import"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button onClick={importPending} disabled={importGuidelines.isPending}>
              <Upload className="h-4 w-4 mr-2" />
              {importGuidelines.isPending ? 'Importing...' : `Import ${pending.length} guideline${pending.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-6 shadow-card">
        <h2 className="text-lg font-semibold mb-3">Library</h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : guidelines.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No guidelines yet — import a Word document above.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Imported from</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guidelines.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="font-medium">{g.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{g.file_name || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(parseISO(g.updated_at), 'dd MMM yyyy')}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setViewing({ title: g.title, html: g.content_html })} title="View">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setRenaming(g);
                        setRenameValue(g.title);
                      }}
                      title="Rename"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(g)} title="Delete">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
          </DialogHeader>
          {viewing && <GuidelineContent html={viewing.html} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename guideline</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="guideline-title">Title</Label>
            <Input id="guideline-title" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              disabled={!renameValue.trim() || renameGuideline.isPending}
              onClick={() => renaming && renameGuideline.mutate({ id: renaming.id, title: renameValue }, { onSuccess: () => setRenaming(null) })}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              It's removed from the library and won't be added to new PDFs. Plans that selected it will simply print without it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && deleteGuideline.mutate(deleting.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default DietGuidelines;

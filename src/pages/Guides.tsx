import { useMemo, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ShareGuideDialog } from '@/components/guides/ShareGuideDialog';
import { MarkGuideSentDialog } from '@/components/guides/MarkGuideSentDialog';
import { GuideSentLog } from '@/components/guides/GuideSentLog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useGuideSends, GuideSend } from '@/hooks/useGuideSends';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { BookOpen, ChevronRight, Copy, ExternalLink, Home, MessageCircle, Pencil, Search, Send, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Guide,
  MAX_GUIDE_BYTES,
  guideUrl,
  useDeleteGuide,
  useGuides,
  useUpdateGuide,
  useUploadGuide,
} from '@/hooks/useGuides';

const formatSize = (bytes: number | null) =>
  bytes === null ? '' : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const isPdf = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');

// Count of clients a guide was sent to, with the list on click.
const SentToCell = ({ sends }: { sends: GuideSend[] }) => {
  if (sends.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
  const clientCount = new Set(sends.map((s) => s.client_id)).size;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="link" size="sm" className="h-auto p-0">
          {clientCount} client{clientCount === 1 ? '' : 's'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <p className="mb-2 text-sm font-medium">Sent to</p>
        <ul className="max-h-64 space-y-1.5 overflow-y-auto">
          {sends.map((s) => (
            <li key={s.id} className="flex justify-between gap-2 text-sm">
              <span>{s.clients?.name ?? 'Deleted client'}</span>
              <span className="text-xs text-muted-foreground">{format(parseISO(s.sent_on), 'dd MMM yy')}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

const Guides = () => {
  const { data: guides = [], isLoading } = useGuides();
  const uploadGuide = useUploadGuide();
  const updateGuide = useUpdateGuide();
  const deleteGuide = useDeleteGuide();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [shareGuide, setShareGuide] = useState<Guide | null>(null);
  const [markSentGuide, setMarkSentGuide] = useState<Guide | null>(null);
  const [tab, setTab] = useState('guides');
  const { data: sends = [] } = useGuideSends();

  const sendsByGuide = useMemo(() => {
    const map = new Map<string, GuideSend[]>();
    for (const send of sends) {
      if (!send.guide_id) continue;
      map.set(send.guide_id, [...(map.get(send.guide_id) ?? []), send]);
    }
    return map;
  }, [sends]);
  const [editing, setEditing] = useState<Guide | null>(null);
  const [editForm, setEditForm] = useState({ title: '', category: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState<Guide | null>(null);

  const categories = useMemo(
    () => [...new Set(guides.map((g) => g.category).filter(Boolean) as string[])].sort(),
    [guides],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guides.filter((g) =>
      (categoryFilter === 'all' || (categoryFilter === 'none' ? !g.category : g.category === categoryFilter)) &&
      (!q || `${g.title} ${g.description ?? ''} ${g.category ?? ''}`.toLowerCase().includes(q)),
    );
  }, [guides, search, categoryFilter]);

  const uploadFiles = async (fileList: FileList | null) => {
    if (!fileList || progress) return;
    const files = Array.from(fileList);
    const skipped = files.filter((f) => !isPdf(f) || f.size > MAX_GUIDE_BYTES);
    const toUpload = files.filter((f) => isPdf(f) && f.size <= MAX_GUIDE_BYTES);
    if (skipped.length) {
      toast.warning(`Skipped ${skipped.length} file${skipped.length === 1 ? '' : 's'}`, {
        description: `Only PDFs up to 50 MB can be uploaded: ${skipped.map((f) => f.name).join(', ')}`,
      });
    }
    if (toUpload.length === 0) return;

    // One at a time keeps memory and connection use low for large batches.
    const failed: string[] = [];
    setProgress({ done: 0, total: toUpload.length });
    for (const [i, file] of toUpload.entries()) {
      try {
        await uploadGuide.mutateAsync({ file, category: uploadCategory });
      } catch (err) {
        console.error('Guide upload failed:', file.name, err);
        failed.push(file.name);
      }
      setProgress({ done: i + 1, total: toUpload.length });
    }
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const ok = toUpload.length - failed.length;
    if (ok) toast.success(`Uploaded ${ok} guide${ok === 1 ? '' : 's'}`);
    if (failed.length) toast.error(`${failed.length} upload${failed.length === 1 ? '' : 's'} failed`, { description: failed.join(', ') });
  };

  const copyLink = async (guide: Guide) => {
    try {
      await navigator.clipboard.writeText(guideUrl(guide));
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const openEdit = (guide: Guide) => {
    setEditing(guide);
    setEditForm({ title: guide.title, category: guide.category ?? '', description: guide.description ?? '' });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editForm.title.trim()) return;
    try {
      await updateGuide.mutateAsync({
        id: editing.id,
        title: editForm.title.trim(),
        category: editForm.category.trim() || null,
        description: editForm.description.trim() || null,
      });
      toast.success('Guide updated');
      setEditing(null);
    } catch {/* toast handled in hook */}
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteGuide.mutateAsync(deleteTarget);
      toast.success('Guide deleted');
      setDeleteTarget(null);
    } catch {/* toast handled in hook */}
  };

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Client Guides</span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Client Guides</h1>
          <p className="text-sm text-muted-foreground">PDF guides to share with clients by link or WhatsApp.</p>
        </div>
      </div>

      {/* Upload */}
      <Card
        className={`mb-6 border-2 border-dashed p-5 transition-colors ${dragging ? 'border-primary bg-primary/5' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files)}
        />
        {progress ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Uploading {progress.done} of {progress.total}…</p>
            <Progress value={(progress.done / progress.total) * 100} className="h-2" />
            <p className="text-xs text-muted-foreground">Keep this page open until the upload finishes.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <p className="font-medium">Drop PDFs here or choose files</p>
              <p className="text-sm text-muted-foreground">
                Upload many at once. Titles come from the file names and can be edited after. Max 50 MB per PDF.
              </p>
            </div>
            <div className="space-y-1.5 md:w-56">
              <Label htmlFor="upload-category" className="text-xs">Category for this batch (optional)</Label>
              <Input
                id="upload-category"
                list="guide-categories"
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                placeholder="e.g. Diabetes"
              />
            </div>
            <Button onClick={() => fileInputRef.current?.click()} className="gradient-primary text-primary-foreground">
              <Upload className="h-4 w-4 mr-2" /> Choose PDFs
            </Button>
          </div>
        )}
      </Card>
      <datalist id="guide-categories">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="guides">Guides ({guides.length})</TabsTrigger>
          <TabsTrigger value="log">Sent log ({sends.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="log">
          <GuideSentLog sends={sends} />
        </TabsContent>

        <TabsContent value="guides">
      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guides" className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            <SelectItem value="none">Uncategorised</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground sm:ml-auto">
          {filtered.length} of {guides.length} guide{guides.length === 1 ? '' : 's'}
        </span>
      </div>

      <Card className="shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guide</TableHead>
              <TableHead className="w-[160px]">Category</TableHead>
              <TableHead className="w-[110px]">Sent to</TableHead>
              <TableHead className="w-[340px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  {isLoading ? 'Loading guides…' : guides.length === 0 ? 'No guides yet — upload PDFs above.' : 'No guides match your filters.'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((g) => (
                <TableRow key={g.id}>
                  <TableCell className="align-top">
                    <div className="font-medium">{g.title}</div>
                    {g.description && <div className="text-sm text-muted-foreground">{g.description}</div>}
                    <div className="text-xs text-muted-foreground">{formatSize(g.file_size)}</div>
                  </TableCell>
                  <TableCell className="align-top">
                    {g.category ? <Badge variant="secondary">{g.category}</Badge> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="align-top">
                    <SentToCell sends={sendsByGuide.get(g.id) ?? []} />
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button size="sm" className="h-8" onClick={() => setShareGuide(g)}>
                        <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setMarkSentGuide(g)}>
                        <Send className="h-3.5 w-3.5 mr-1" /> Mark sent
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Copy link" onClick={() => copyLink(g)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Open PDF" asChild>
                        <a href={guideUrl(g)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" onClick={() => openEdit(g)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Delete" onClick={() => setDeleteTarget(g)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

        </TabsContent>
      </Tabs>

      <MarkGuideSentDialog guide={markSentGuide} onOpenChange={(o) => !o && setMarkSentGuide(null)} />
      <ShareGuideDialog guide={shareGuide} onOpenChange={(o) => !o && setShareGuide(null)} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Guide</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guide-title">Title *</Label>
              <Input id="guide-title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guide-category">Category</Label>
              <Input
                id="guide-category"
                list="guide-categories"
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                placeholder="e.g. Diabetes, PCOS, Recipes"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guide-description">Description</Label>
              <Textarea
                id="guide-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">File: {editing?.file_name}</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={updateGuide.isPending || !editForm.title.trim()}>
                {updateGuide.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Guide</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deleteTarget?.title}"? The PDF is removed and any links already shared with clients will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Guides;

import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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
import { ChevronRight, Home, Pencil, Pill, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Supplement,
  supplementLine,
  useCreateSupplement,
  useDeleteSupplement,
  useSupplements,
  useUpdateSupplement,
} from '@/hooks/useSupplements';

const Supplements = () => {
  const { data: supplements = [], isLoading } = useSupplements();
  const createSupplement = useCreateSupplement();
  const updateSupplement = useUpdateSupplement();
  const deleteSupplement = useDeleteSupplement();

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplement | null>(null);
  const [name, setName] = useState('');
  const [directions, setDirections] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Supplement | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return supplements;
    return supplements.filter((s) => `${s.name} ${s.directions}`.toLowerCase().includes(q));
  }, [supplements, search]);

  const openForm = (s: Supplement | null) => {
    setEditing(s);
    setName(s?.name ?? '');
    setDirections(s?.directions ?? '');
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { name: name.trim(), directions: directions.trim() };
    if (!input.name) return;
    try {
      if (editing) {
        await updateSupplement.mutateAsync({ id: editing.id, ...input });
        toast.success('Supplement updated');
      } else {
        await createSupplement.mutateAsync(input);
        toast.success('Supplement added');
      }
      setFormOpen(false);
    } catch {/* toast handled in hook */}
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSupplement.mutateAsync(deleteTarget.id);
      toast.success('Supplement deleted');
      setDeleteTarget(null);
    } catch {/* toast handled in hook */}
  };

  const saving = createSupplement.isPending || updateSupplement.isPending;

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Supplements</span>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-3">
          <Pill className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Supplements</h1>
            <p className="text-sm text-muted-foreground">
              The list offered in the supplements dropdown when making a diet plan.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search supplements"
              className="pl-9 sm:w-[240px]"
            />
          </div>
          <Button className="gradient-primary text-primary-foreground" onClick={() => openForm(null)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Supplement
          </Button>
        </div>
      </div>

      <Card className="shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">Name</TableHead>
              <TableHead>Directions</TableHead>
              <TableHead className="w-[110px]">In dropdown</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  {isLoading ? 'Loading supplements…' : search ? 'No supplements match your search' : 'No supplements yet'}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id} className={s.is_active ? '' : 'opacity-60'}>
                  <TableCell className="font-medium align-top">{s.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground align-top">{s.directions || '—'}</TableCell>
                  <TableCell className="align-top">
                    <Switch
                      checked={s.is_active}
                      onCheckedChange={(checked) => updateSupplement.mutate({ id: s.id, is_active: checked })}
                      aria-label={`Show ${s.name} in dropdown`}
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openForm(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(s)}>
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Supplement' : 'Add Supplement'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supplement-name">Name *</Label>
              <Input
                id="supplement-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Magnesium relax (brand- Miduty)"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplement-directions">Directions</Label>
              <Textarea
                id="supplement-directions"
                value={directions}
                onChange={(e) => setDirections(e.target.value)}
                placeholder="e.g. * 60 days -- post dinner"
                rows={3}
              />
            </div>
            {name.trim() && (
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <span className="text-xs text-muted-foreground block mb-1">Appears in the diet plan as</span>
                {supplementLine({ name, directions })}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Supplement'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplement</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deleteTarget?.name}" from the list? Existing diet plans are not affected. To keep it but hide it from
              the dropdown, turn off "In dropdown" instead.
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

export default Supplements;

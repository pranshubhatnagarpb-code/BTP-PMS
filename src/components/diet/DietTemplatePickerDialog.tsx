// Pick a saved diet chart template (used by the manual diet planner).
import { useState } from 'react';
import { BookTemplate, Loader2, Search } from 'lucide-react';
import { useDietChartTemplates, type DietChartTemplate } from '@/hooks/useDietChartTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (template: DietChartTemplate) => void;
}

export const DietTemplatePickerDialog = ({ open, onOpenChange, onPick }: Props) => {
  const { data: templates = [], isLoading } = useDietChartTemplates();
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const shown = templates.filter(
    (t) => !q || [t.name, t.category, t.description ?? ''].some((v) => v.toLowerCase().includes(q)),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose Diet Chart Template</DialogTitle>
        </DialogHeader>
        {templates.length > 5 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates..." className="pl-9" />
          </div>
        )}
        <div className="-mx-6 overflow-y-auto px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No diet chart templates yet. Save one from the AI diet plan generator ("Save as Template") first.
            </p>
          ) : shown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No templates match “{search}”.</p>
          ) : (
            <div className="divide-y rounded-lg border">
              {shown.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-medium">{t.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {t.category} · {t.template_data.length} day{t.template_data.length === 1 ? '' : 's'} · Updated{' '}
                      {new Date(t.updated_at).toLocaleDateString()}
                    </p>
                    {t.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => onPick(t)}>
                    <BookTemplate className="h-3.5 w-3.5 mr-1" /> Use Template
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

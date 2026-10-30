// Edit a guideline for one plan only: the library copy (Diet Guidelines page) stays unchanged.
import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, List, ListOrdered, Redo2, RotateCcw, Underline, Undo2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sanitizeGuidelineHtml } from '@/lib/dietGuidelines';
import type { GuidelineEdit } from '@/hooks/useDietGuidelines';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the editor starts with: the plan's edited copy, else the library version. */
  initial: GuidelineEdit;
  /** The library version, for "Reset"; null when it has been deleted from the library. */
  original: GuidelineEdit | null;
  isEdited: boolean;
  onSave: (edit: GuidelineEdit) => void;
  /** Drops this plan's edits and goes back to the library version. */
  onReset: () => void;
}

const TOOLS = [
  { command: 'bold', icon: Bold, label: 'Bold' },
  { command: 'italic', icon: Italic, label: 'Italic' },
  { command: 'underline', icon: Underline, label: 'Underline' },
  { command: 'insertUnorderedList', icon: List, label: 'Bullet list' },
  { command: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list' },
  { command: 'undo', icon: Undo2, label: 'Undo' },
  { command: 'redo', icon: Redo2, label: 'Redo' },
] as const;

export const GuidelineEditDialog = ({ open, onOpenChange, initial, original, isEdited, onSave, onReset }: Props) => {
  const [title, setTitle] = useState(initial.title);
  const editorRef = useRef<HTMLDivElement>(null);

  // Load the content each time the dialog opens; afterwards the editor owns it.
  useEffect(() => {
    if (!open) return;
    setTitle(initial.title);
    // Wait for the dialog content to mount.
    const id = requestAnimationFrame(() => {
      if (editorRef.current) editorRef.current.innerHTML = sanitizeGuidelineHtml(initial.html);
    });
    return () => cancelAnimationFrame(id);
    // Only on open: a parent re-render must not wipe what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const run = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
  };

  const save = () => {
    const html = sanitizeGuidelineHtml(editorRef.current?.innerHTML ?? '');
    onSave({ title: title.trim() || initial.title, html });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>Edit guideline for this plan</DialogTitle>
          <DialogDescription>
            Changes apply only to this diet plan. The guideline in the Diet Guidelines library stays as it is.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="guideline-title">Title</Label>
          <Input id="guideline-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col rounded-md border">
          <div className="flex flex-wrap gap-1 border-b bg-muted/40 p-1">
            {TOOLS.map(({ command, icon: Icon, label }) => (
              <Button
                key={command}
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={label}
                aria-label={label}
                // Keep the editor's selection when clicking the toolbar.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => run(command)}
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className={cn(
              'min-h-[300px] flex-1 overflow-y-auto p-4 text-sm leading-relaxed outline-none',
              '[&_p]:my-1.5 [&_strong]:font-semibold [&_a]:text-primary [&_a]:underline',
              '[&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-bold [&_h3]:mt-2 [&_h3]:font-semibold',
              '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5',
              '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_td]:align-top [&_th]:border [&_th]:p-2',
              '[&_tr:first-child_td]:bg-muted/60 [&_img]:my-2 [&_img]:max-w-full',
            )}
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={!isEdited || !original}
            title={original ? undefined : 'The library version has been deleted'}
            onClick={() => {
              onReset();
              onOpenChange(false);
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to library version
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save}>
              Save for this plan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

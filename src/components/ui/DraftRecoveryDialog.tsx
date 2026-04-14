import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, RotateCcw, Trash2, FileText } from 'lucide-react';
import { DraftData } from '@/hooks/useDraftRecovery';
import { format } from 'date-fns';

interface DraftRecoveryDialogProps {
  open: boolean;
  onClose: () => void;
  drafts: DraftData[];
  onRestoreDraft: (draft: DraftData) => void;
  onDeleteDraft: (draftId: string) => void;
}

export const DraftRecoveryDialog = ({
  open,
  onClose,
  drafts,
  onRestoreDraft,
  onDeleteDraft
}: DraftRecoveryDialogProps) => {
  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), 'MMM dd, yyyy at h:mm a');
  };

  const getDraftTitle = (draft: DraftData) => {
    if (draft.type === 'template') {
      return draft.data?.name || 'Untitled Template';
    } else {
      return draft.data?.planName || 'Untitled Diet Plan';
    }
  };

  const getDraftDescription = (draft: DraftData) => {
    if (draft.type === 'template') {
      return draft.data?.description || 'Template draft';
    } else {
      const clientName = draft.data?.clientDetails?.name || 'Unknown Client';
      return `Diet plan for ${clientName}`;
    }
  };

  if (drafts.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recover Your Work
          </DialogTitle>
          <DialogDescription>
            We found {drafts.length} unsaved {drafts.length === 1 ? 'draft' : 'drafts'}. Would you like to restore any of them?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {drafts.map((draft) => (
            <Card key={draft.id} className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {getDraftTitle(draft)}
                    </CardTitle>
                    <CardDescription>
                      {getDraftDescription(draft)}
                    </CardDescription>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Last edited: {formatDate(draft.lastModified)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={draft.type === 'template' ? 'secondary' : 'default'}>
                      {draft.type === 'template' ? 'Template' : 'Diet Plan'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    This {draft.type} was automatically saved due to an incomplete save or page refresh.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteDraft(draft.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onRestoreDraft(draft)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restore
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Choose "Restore" to continue working on your draft, or "Delete" to remove it permanently.
            </p>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

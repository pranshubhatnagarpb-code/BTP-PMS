import { useState } from 'react';
import { differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FlaskConical, Loader2, Pencil, RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { BloodReport, useAnalyzeBloodReport } from '@/hooks/useBloodReports';
import type { Client } from '@/hooks/useClients';
import { CONCERN_BADGE_CLASS, analysisToPromptText, reportHasValues } from '@/lib/bloodReportAnalysis';
import { BloodReportAnalysisView } from '@/components/blood-reports/BloodReportAnalysisView';

// Reports older than this are flagged so the nutritionist can decide whether they still apply.
const STALE_AFTER_DAYS = 180;

interface Props {
  client: Client;
  latestReport: BloodReport | undefined;
  previousReport: BloodReport | undefined;
  isLoading: boolean;
  useAnalysis: boolean;
  onUseAnalysisChange: (use: boolean) => void;
  // The nutritionist's edited version of the analysis sent to the AI for this plan;
  // null means the AI analysis is used as is. The saved report analysis is never changed.
  editedText: string | null;
  onEditedTextChange: (text: string | null) => void;
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const BloodAnalysisForDietCard = ({
  client,
  latestReport,
  previousReport,
  isLoading,
  useAnalysis,
  onUseAnalysisChange,
  editedText,
  onEditedTextChange,
}: Props) => {
  const analyze = useAnalyzeBloodReport();
  const [showFull, setShowFull] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [draft, setDraft] = useState('');

  const analysis = latestReport?.ai_analysis ?? null;
  const ageDays = latestReport ? differenceInDays(new Date(), new Date(latestReport.report_date)) : 0;

  const runAnalysis = async () => {
    if (!latestReport) return;
    try {
      await analyze.mutateAsync({ report: latestReport, previous: previousReport ?? null, client });
      onUseAnalysisChange(true);
      toast.success('Blood report analysed');
    } catch {/* toast handled in hook */}
  };

  const openEdit = () => {
    if (!analysis || !latestReport) return;
    setDraft(editedText ?? analysisToPromptText(analysis, latestReport.report_date));
    setShowEdit(true);
  };

  const saveEdit = () => {
    const text = draft.trim();
    onEditedTextChange(text ? text : null);
    if (text) onUseAnalysisChange(true);
    setShowEdit(false);
  };

  let body: React.ReactNode;
  if (isLoading) {
    body = <p className="text-sm text-muted-foreground">Loading blood reports…</p>;
  } else if (!latestReport) {
    body = <p className="text-sm text-muted-foreground">No blood report on file for {client.name}. Add one under Blood Reports to use it here.</p>;
  } else if (!analysis) {
    const hasValues = reportHasValues(latestReport);
    body = (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {hasValues
            ? `The latest report (${formatDate(latestReport.report_date)}) hasn't been analysed yet.`
            : `The latest report (${formatDate(latestReport.report_date)}) has no recorded values.`}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={runAnalysis} disabled={!hasValues || analyze.isPending}>
          {analyze.isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analysing…</>
            : <><Sparkles className="mr-2 h-4 w-4" /> Analyse with AI</>}
        </Button>
      </div>
    );
  } else {
    body = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Report dated {formatDate(latestReport.report_date)}</span>
          <Badge variant="outline" className={`capitalize ${CONCERN_BADGE_CLASS[analysis.overallConcern]}`}>
            {analysis.overallConcern} concern
          </Badge>
          {ageDays > STALE_AFTER_DAYS && (
            <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
              {Math.floor(ageDays / 30)} months old
            </Badge>
          )}
          {editedText !== null && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              Edited for this plan
            </Badge>
          )}
        </div>
        {editedText !== null ? (
          <p className="whitespace-pre-line text-sm leading-relaxed">{editedText}</p>
        ) : (
          <>
            <p className="text-sm leading-relaxed">{analysis.summary}</p>
            {analysis.nutritionPriorities.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                {analysis.nutritionPriorities.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            )}
          </>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={openEdit}>
            <Pencil className="mr-1 h-3 w-3" /> Edit for this plan
          </Button>
          {editedText !== null && (
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-muted-foreground" onClick={() => onEditedTextChange(null)}>
              <RotateCcw className="mr-1 h-3 w-3" /> Reset to AI analysis
            </Button>
          )}
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setShowFull(true)}>
            View full analysis
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          <h4 className="font-medium">Blood Report Analysis</h4>
        </div>
        {analysis && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <span className="text-muted-foreground">Use in diet plan</span>
            <Switch checked={useAnalysis} onCheckedChange={onUseAnalysisChange} />
          </label>
        )}
      </div>
      {body}

      {analysis && (
        <Dialog open={showFull} onOpenChange={setShowFull}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Blood Report Analysis — {client.name}</DialogTitle>
            </DialogHeader>
            <BloodReportAnalysisView analysis={analysis} />
          </DialogContent>
        </Dialog>
      )}

      {analysis && (
        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Blood Report Analysis</DialogTitle>
              <DialogDescription>
                This exact text is given to the AI when generating this diet plan. The saved blood report analysis is not changed.
              </DialogDescription>
            </DialogHeader>
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={16} className="text-sm" />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
              <Button type="button" onClick={saveEdit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

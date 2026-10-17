import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { BloodReport, BloodReportWithClient, useAnalyzeBloodReport } from '@/hooks/useBloodReports';
import type { Client } from '@/hooks/useClients';
import { reportHasValues } from '@/lib/bloodReportAnalysis';
import { BloodReportAnalysisView } from './BloodReportAnalysisView';

interface Props {
  report: BloodReportWithClient | null;
  previous: BloodReport | null;
  client: Client | null;
  onOpenChange: (open: boolean) => void;
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

export const BloodReportAnalysisDialog = ({ report, previous, client, onOpenChange }: Props) => {
  const analyze = useAnalyzeBloodReport();
  const analysis = report?.ai_analysis ?? null;
  const hasValues = report ? reportHasValues(report) : false;

  const run = async () => {
    if (!report) return;
    try {
      await analyze.mutateAsync({ report, previous, client });
      toast.success('Blood report analysed');
    } catch {/* toast handled in hook */}
  };

  return (
    <Dialog open={!!report} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Analysis of Blood Report
          </DialogTitle>
          {report && (
            <DialogDescription>
              {report.client_name} · Report dated {formatDate(report.report_date)}
              {previous && ` · compared with ${formatDate(previous.report_date)}`}
            </DialogDescription>
          )}
        </DialogHeader>

        {analyze.isPending ? (
          <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Analysing the report…
          </div>
        ) : analysis ? (
          <>
            <BloodReportAnalysisView analysis={analysis} />
            <div className="flex items-center justify-between gap-2 border-t pt-4">
              <span className="text-xs text-muted-foreground">
                {report?.ai_analysis_generated_at && `Generated ${new Date(report.ai_analysis_generated_at).toLocaleString('en-IN')}`}
              </span>
              <Button variant="outline" onClick={run}>
                <RefreshCw className="mr-2 h-4 w-4" /> Regenerate
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {hasValues
                ? 'Get an AI interpretation of this report with nutrition priorities. You can then use it when generating a diet plan.'
                : 'This report has no recorded values. Add values to the report before analysing it.'}
            </p>
            <Button onClick={run} disabled={!hasValues} className="gradient-primary text-primary-foreground">
              <Sparkles className="mr-2 h-4 w-4" /> Analyse with AI
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

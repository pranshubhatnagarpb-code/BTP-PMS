import { Badge } from '@/components/ui/badge';
import {
  BloodReportAnalysis,
  CONCERN_BADGE_CLASS,
  FINDING_BADGE_CLASS,
} from '@/lib/bloodReportAnalysis';

const ListBlock = ({ title, items }: { title: string; items: string[] }) =>
  items.length === 0 ? null : (
    <div className="space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );

export const BloodReportAnalysisView = ({ analysis }: { analysis: BloodReportAnalysis }) => (
  <div className="space-y-5">
    <div className="rounded-lg border bg-muted/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        <h4 className="text-sm font-semibold">Summary</h4>
        <Badge variant="outline" className={`capitalize ${CONCERN_BADGE_CLASS[analysis.overallConcern]}`}>
          {analysis.overallConcern} concern
        </Badge>
      </div>
      <p className="text-sm leading-relaxed">{analysis.summary}</p>
    </div>

    {analysis.findings.length > 0 && (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Findings</h4>
        <div className="divide-y rounded-lg border">
          {analysis.findings.map((f, i) => (
            <div key={i} className="space-y-1 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{f.marker}</span>
                <span className="text-sm text-muted-foreground">{f.value}</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize ${FINDING_BADGE_CLASS[f.status]}`}>
                  {f.status}
                </Badge>
                {f.trend && <span className="text-xs text-muted-foreground">· {f.trend}</span>}
              </div>
              <p className="text-sm text-muted-foreground">{f.interpretation}</p>
            </div>
          ))}
        </div>
      </div>
    )}

    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <ListBlock title="Nutrition priorities" items={analysis.nutritionPriorities} />
      <ListBlock title="Foods to include" items={analysis.foodsToInclude} />
      <ListBlock title="Foods to limit" items={analysis.foodsToLimit} />
      <ListBlock title="Supplement considerations" items={analysis.supplementConsiderations} />
    </div>
    <ListBlock title="Follow-up" items={analysis.followUp} />

    <p className="text-xs text-muted-foreground">
      AI-generated interpretation for the nutritionist's review. It is not a medical diagnosis.
    </p>
  </div>
);

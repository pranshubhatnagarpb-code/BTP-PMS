import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Eye, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useClientIntakeSubmissions, type IntakeSubmission } from '@/hooks/useIntakeSubmissions';

interface Props {
  clientId: string;
  clientName: string;
}

const STATUS_STYLES: Record<IntakeSubmission['pms_status'], { label: string; className: string }> = {
  sent: { label: 'Synced', className: 'text-success border-success/30' },
  duplicate_merged: { label: 'Merged', className: 'text-success border-success/30' },
  pending: { label: 'Pending', className: 'text-muted-foreground' },
  failed: { label: 'Failed', className: 'text-destructive border-destructive/30' },
};

// Turns camelCase / snake_case payload keys into readable labels
// (e.g. "guardianPhone" / "guardian_phone" -> "Guardian Phone").
const humanizeKey = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

const isEmptyValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
};

// Recursively renders an arbitrary intake payload section — objects become
// nested key/value blocks, arrays of primitives become tag lists, arrays of
// objects become repeated sub-blocks. This covers the full nested schema
// (symptoms, lifestyle, medical history, etc.) without hand-mapping every
// one of its ~15 optional sections.
const ValueNode = ({ value }: { value: unknown }) => {
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;

  if (Array.isArray(value)) {
    const isPrimitiveList = value.every((v) => typeof v !== 'object' || v === null);
    if (isPrimitiveList) {
      return (
        <div className="flex flex-wrap gap-1">
          {value.map((v, i) => (
            <Badge key={i} variant="secondary" className="font-normal">
              {String(v)}
            </Badge>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {value.map((v, i) => (
          <div key={i} className="rounded-md border bg-muted/30 p-2">
            <ObjectNode obj={v as Record<string, unknown>} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object' && value !== null) {
    return <ObjectNode obj={value as Record<string, unknown>} />;
  }

  return <span className="font-medium">{String(value)}</span>;
};

const ObjectNode = ({ obj }: { obj: Record<string, unknown> }) => {
  const entries = Object.entries(obj).filter(([, v]) => !isEmptyValue(v));
  if (entries.length === 0) return <span className="text-sm text-muted-foreground">—</span>;

  return (
    <div className="space-y-1.5">
      {entries.map(([key, value]) => {
        const isComplex = typeof value === 'object' && value !== null;
        return (
          <div key={key} className={isComplex ? 'space-y-1' : 'flex items-baseline justify-between gap-3 text-sm'}>
            <span className={isComplex ? 'text-xs font-semibold text-muted-foreground uppercase tracking-wide' : 'text-muted-foreground shrink-0'}>
              {humanizeKey(key)}
            </span>
            {isComplex ? (
              <div className="pl-3 border-l">
                <ValueNode value={value} />
              </div>
            ) : (
              <span className="text-right">
                <ValueNode value={value} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Top-level keys shown in their own labeled header (contact/guardian above
// everything else); the rest of the payload renders generically below.
const HEADER_KEYS = ['contact', 'guardian'];
const SKIPPED_KEYS = ['version', 'branch', ...HEADER_KEYS];

const SubmissionCard = ({ submission }: { submission: IntakeSubmission }) => {
  const status = STATUS_STYLES[submission.pms_status];
  const payload = submission.payload as Record<string, unknown>;
  const headerKey = HEADER_KEYS.find((k) => !isEmptyValue(payload[k]));
  // "Others" submits on the male branch, so prefer the gender the client picked.
  const gender = (payload.contact as { gender?: string } | undefined)?.gender ?? submission.branch;
  const sections = Object.entries(payload).filter(([key, value]) => !SKIPPED_KEYS.includes(key) && !isEmptyValue(value));

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-sm">{submission.full_name}</p>
          <p className="text-xs text-muted-foreground">
            {format(parseISO(submission.created_at), 'dd MMM yyyy, h:mm a')} ·{' '}
            <span className="capitalize">{gender}</span>
          </p>
        </div>
        <Badge variant="outline" className={status.className}>
          {status.label}
        </Badge>
      </div>

      {submission.pms_error && <p className="text-xs text-destructive">Sync error: {submission.pms_error}</p>}

      {headerKey && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            {humanizeKey(headerKey)}
          </h4>
          <ObjectNode obj={payload[headerKey] as Record<string, unknown>} />
        </div>
      )}

      {sections.map(([key, value]) => (
        <div key={key}>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{humanizeKey(key)}</h4>
          <ValueNode value={value} />
        </div>
      ))}
    </div>
  );
};

export const IntakeResponseDialog = ({ clientId, clientName }: Props) => {
  const [open, setOpen] = useState(false);
  const { data: submissions = [], isLoading } = useClientIntakeSubmissions(clientId, open);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 ml-1 text-muted-foreground shrink-0"
          title="View assessment form response"
          onClick={(e) => e.stopPropagation()}
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Assessment Form — {clientName}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No assessment form submission linked to this client yet.
          </p>
        ) : (
          <div className="space-y-4">
            {submissions.map((s) => (
              <SubmissionCard key={s.id} submission={s} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

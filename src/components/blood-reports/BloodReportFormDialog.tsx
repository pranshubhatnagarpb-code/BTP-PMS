import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useActiveClients } from '@/hooks/useClients';
import { BloodReportInput, BloodReportWithClient } from '@/hooks/useBloodReports';
import { BLOOD_MARKERS, BloodMarkerKey, getMarkerStatus, STATUS_BADGE_CLASS } from '@/lib/bloodMarkers';
import { extractFromFile, extractFromFiles, ExtractedValues } from '@/lib/bloodReportParser';
import { Upload, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report?: BloodReportWithClient | null;
  defaultClientId?: string;
  onSubmit: (data: BloodReportInput) => Promise<void>;
  isLoading?: boolean;
}

const today = new Date().toISOString().split('T')[0];

type ValuesState = Record<BloodMarkerKey, string>;

const emptyValues = (): ValuesState =>
  BLOOD_MARKERS.reduce((acc, m) => { acc[m.key] = ''; return acc; }, {} as ValuesState);

const parseOptionalNumber = (v: string): number | null => {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const BloodReportFormDialog = ({ open, onOpenChange, report, defaultClientId, onSubmit, isLoading }: Props) => {
  const { data: clients = [] } = useActiveClients();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);

  const [clientId, setClientId] = useState('');
  const [reportDate, setReportDate] = useState(today);
  const [labName, setLabName] = useState('');
  const [notes, setNotes] = useState('');
  const [values, setValues] = useState<ValuesState>(emptyValues());

  const isEdit = !!report;

  useEffect(() => {
    if (report) {
      setClientId(report.client_id);
      setReportDate(report.report_date);
      setLabName(report.lab_name || '');
      setNotes(report.notes || '');
      setFileName(report.source_file_name);
      const next = emptyValues();
      if (report.values) {
        for (const m of BLOOD_MARKERS) {
          const v = (report.values as any)[m.key];
          if (v !== null && v !== undefined) next[m.key] = String(v);
        }
      }
      setValues(next);
      setWarnings([]);
      return;
    }
    setClientId(defaultClientId || '');
    setReportDate(today);
    setLabName('');
    setNotes('');
    setFileName(null);
    setValues(emptyValues());
    setWarnings([]);
  }, [report, defaultClientId, open]);

  const applyExtracted = (extracted: ExtractedValues) => {
    setValues((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(extracted)) {
        if (v !== undefined && v !== null) next[k as BloodMarkerKey] = String(v);
      }
      return next;
    });
  };

  const handleFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setParsing(true);
    setWarnings([]);
    const fileArray = Array.from(files);
    setFileNames(fileArray.map(f => f.name));
    setFileName(`${fileArray.length} file${fileArray.length === 1 ? '' : 's'}`);

    try {
      const result = await extractFromFiles(fileArray);
      applyExtracted(result.values);
      setWarnings(result.warnings);
      if (result.reportDate) setReportDate(result.reportDate);
      if (result.labName && !labName) setLabName(result.labName);
      if (result.notes && !notes) setNotes(result.notes);
      const count = Object.keys(result.values).length;
      if (count > 0) {
        toast.success(`Extracted ${count} value${count === 1 ? '' : 's'} from ${fileArray.length} image${fileArray.length === 1 ? '' : 's'}. Please review before saving.`);
      } else {
        toast.warning('No values were detected. Please enter them manually.');
      }
    } catch (err: any) {
      toast.error('Extraction failed', { description: err?.message || 'Please try again or enter values manually.' });
    } finally {
      setParsing(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, typeof BLOOD_MARKERS>();
    for (const m of BLOOD_MARKERS) {
      const arr = map.get(m.group) || [];
      arr.push(m);
      map.set(m.group, arr);
    }
    return Array.from(map.entries());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !reportDate) return;

    const numericValues = BLOOD_MARKERS.reduce((acc, m) => {
      acc[m.key] = parseOptionalNumber(values[m.key]);
      return acc;
    }, {} as Record<BloodMarkerKey, number | null>);

    await onSubmit({
      client_id: clientId,
      report_date: reportDate,
      lab_name: labName.trim() || null,
      source_file_name: fileName || null,
      notes: notes.trim() || null,
      values: numericValues,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Blood Report' : 'Upload & Review Blood Report'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Report Date *</Label>
              <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Lab Name</Label>
              <Input value={labName} onChange={(e) => setLabName(e.target.value)} placeholder="Optional, e.g., Dr Lal PathLabs" />
            </div>
          </div>

          {/* 
  // Blood Report Upload Section - Temporarily Hidden
  // TODO: Uncomment when ready to deploy multi-image upload feature
  {!isEdit && (
            <div className="rounded-lg border-2 border-dashed border-border p-4 bg-muted/30">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFile(e.target.files);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={parsing}
                  className="w-full sm:w-auto"
                >
                  {parsing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {parsing ? 'Extracting…' : 'Upload Images (Multiple)'}
                </Button>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  {fileName ? (
                    <><FileText className="h-3.5 w-3.5" /> <span>{fileName}</span></>
                  ) : (
                    <span>Optional. Upload multiple images (screenshots of PDF pages). Files are used only to extract values — not stored.</span>
                  )}
                </div>
              </div>
              {warnings.length > 0 && (
                <ul className="mt-3 text-xs text-warning space-y-1">
                  {warnings.map((w, i) => <li key={i}>• {w}</li>)}
                </ul>
              )}
            </div>
          )}
*/}

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Review Extracted Values</h3>
              <p className="text-xs text-muted-foreground mt-1">All fields are optional. Edit any value before saving. Status badges use standard adult reference ranges.</p>
            </div>

            {grouped.map(([group, markers]) => (
              <div key={group} className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">{group}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {markers.map((m) => {
                    const numeric = parseOptionalNumber(values[m.key]);
                    const status = getMarkerStatus(m.key, numeric);
                    return (
                      <div key={m.key} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={m.key} className="text-xs">{m.label} <span className="text-muted-foreground">({m.unit})</span></Label>
                          {numeric !== null && status !== 'unknown' && (
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_BADGE_CLASS[status]}`}>
                              {status}
                            </Badge>
                          )}
                        </div>
                        <Input
                          id={m.key}
                          type="number"
                          step="0.01"
                          min="0"
                          value={values[m.key]}
                          onChange={(e) => setValues((prev) => ({ ...prev, [m.key]: e.target.value }))}
                          placeholder={m.refLow !== null && m.refHigh !== null ? `${m.refLow}–${m.refHigh}` : m.refHigh !== null ? `< ${m.refHigh}` : m.refLow !== null ? `> ${m.refLow}` : ''}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-notes">Notes</Label>
            <Textarea id="report-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes — fasting status, observations, follow-up actions" rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isLoading || !clientId || !reportDate}>
              {isLoading ? (isEdit ? 'Updating…' : 'Saving…') : (isEdit ? 'Update Report' : 'Save Report')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

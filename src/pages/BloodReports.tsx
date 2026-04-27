import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { BloodReportFormDialog } from '@/components/blood-reports/BloodReportFormDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { useActiveClients } from '@/hooks/useClients';
import {
  BloodReportInput,
  BloodReportWithClient,
  useBloodReports,
  useCreateBloodReport,
  useDeleteBloodReport,
  useUpdateBloodReport,
} from '@/hooks/useBloodReports';
import { BLOOD_MARKERS, BLOOD_MARKER_MAP, BloodMarkerKey, getMarkerStatus, STATUS_BADGE_CLASS } from '@/lib/bloodMarkers';
import { Home, ChevronRight, FlaskConical, Plus, Pencil, Trash2, Activity, Droplets, HeartPulse } from 'lucide-react';
import { toast } from 'sonner';
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
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';

const TREND_MARKERS: BloodMarkerKey[] = ['hba1c', 'fasting_blood_sugar', 'total_cholesterol', 'vitamin_d', 'vitamin_b12', 'tsh'];

const formatVal = (v: number | null | undefined, unit?: string) =>
  v === null || v === undefined ? '—' : `${v}${unit ? ' ' + unit : ''}`;

const BloodReports = () => {
  const { data: clients = [] } = useActiveClients();
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [tab, setTab] = useState('history');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BloodReportWithClient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BloodReportWithClient | null>(null);

  const effectiveClientId = selectedClientId === 'all' ? undefined : selectedClientId;
  const { data: reports = [], isLoading } = useBloodReports(effectiveClientId);
  const createReport = useCreateBloodReport();
  const updateReport = useUpdateBloodReport();
  const deleteReport = useDeleteBloodReport();

  const selectedClient = clients.find((c) => c.id === effectiveClientId);

  const sortedAsc = useMemo(() => [...reports].reverse(), [reports]);
  const latest = reports[0];
  const previous = reports[1];

  const trendData = useMemo(() => sortedAsc.map((r) => {
    const v = r.values || {};
    return {
      date: new Date(r.report_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }),
      ...TREND_MARKERS.reduce((acc, k) => {
        acc[k] = (v as any)[k] ?? null;
        return acc;
      }, {} as Record<string, number | null>),
    };
  }), [sortedAsc]);

  const trendChartConfig = useMemo(() => TREND_MARKERS.reduce((acc, k, i) => {
    const colors = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))', 'hsl(var(--accent-foreground))'];
    acc[k] = { label: BLOOD_MARKER_MAP[k].label, color: colors[i % colors.length] };
    return acc;
  }, {} as Record<string, { label: string; color: string }>), []);

  const handleCreate = async (data: BloodReportInput) => {
    try {
      await createReport.mutateAsync(data);
      toast.success('Blood report saved successfully!');
      setFormOpen(false);
    } catch {/* toast handled in hook */}
  };

  const handleUpdate = async (data: BloodReportInput) => {
    if (!editing) return;
    try {
      await updateReport.mutateAsync({ ...data, id: editing.id });
      toast.success('Blood report updated successfully!');
      setEditing(null);
      setFormOpen(false);
    } catch {/* */}
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteReport.mutateAsync({ id: deleteTarget.id, clientId: deleteTarget.client_id });
      toast.success('Blood report deleted.');
      setDeleteTarget(null);
    } catch {/* */}
  };

  const renderMarkerCell = (item: BloodReportWithClient, key: BloodMarkerKey) => {
    const v = item.values ? (item.values as any)[key] : null;
    const status = getMarkerStatus(key, v);
    if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="flex items-center gap-1.5">
        <span className="font-medium">{v}</span>
        {status !== 'unknown' && status !== 'normal' && (
          <Badge variant="outline" className={`text-[10px] px-1 py-0 ${STATUS_BADGE_CLASS[status]}`}>{status}</Badge>
        )}
      </div>
    );
  };

  const columns = [
    {
      key: 'report_date',
      header: 'Date',
      render: (item: BloodReportWithClient) => new Date(item.report_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    ...(effectiveClientId ? [] : [{
      key: 'client_name',
      header: 'Client',
      render: (item: BloodReportWithClient) => <span className="font-medium text-primary">{item.client_name}</span>,
    }]),
    { key: 'hba1c', header: 'HbA1c', render: (item: BloodReportWithClient) => renderMarkerCell(item, 'hba1c') },
    { key: 'fbs', header: 'Fasting', render: (item: BloodReportWithClient) => renderMarkerCell(item, 'fasting_blood_sugar') },
    { key: 'chol', header: 'Cholesterol', render: (item: BloodReportWithClient) => renderMarkerCell(item, 'total_cholesterol') },
    { key: 'vitd', header: 'Vit D', render: (item: BloodReportWithClient) => renderMarkerCell(item, 'vitamin_d') },
    { key: 'tsh', header: 'TSH', render: (item: BloodReportWithClient) => renderMarkerCell(item, 'tsh') },
    {
      key: 'lab',
      header: 'Lab',
      render: (item: BloodReportWithClient) => item.lab_name ? <Badge variant="secondary" className="max-w-[140px] truncate">{item.lab_name}</Badge> : '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: BloodReportWithClient) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setEditing(item); setFormOpen(true); }}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Blood Reports</span>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Blood Reports</h1>
            <p className="text-sm text-muted-foreground">Upload, extract and track biomarker history for each client.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue placeholder="Filter by client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="gradient-primary text-primary-foreground" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Latest HbA1c"
          value={formatVal(latest?.values?.hba1c, '%')}
          subtitle={selectedClient?.name || 'Most recent across clients'}
          icon={<Droplets className="h-5 w-5" />}
        />
        <StatCard
          title="Fasting Sugar"
          value={formatVal(latest?.values?.fasting_blood_sugar, 'mg/dL')}
          subtitle={previous ? `Prev: ${formatVal(previous.values?.fasting_blood_sugar)}` : '—'}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          title="Total Cholesterol"
          value={formatVal(latest?.values?.total_cholesterol, 'mg/dL')}
          subtitle={previous ? `Prev: ${formatVal(previous.values?.total_cholesterol)}` : '—'}
          icon={<HeartPulse className="h-5 w-5" />}
        />
        <StatCard
          title="Reports"
          value={reports.length}
          subtitle={latest ? `Last on ${new Date(latest.report_date).toLocaleDateString('en-IN')}` : 'No reports yet'}
          icon={<FlaskConical className="h-5 w-5" />}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="charts">Trend Charts</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {effectiveClientId ? `${selectedClient?.name || 'Client'} Blood Report History` : 'All Blood Reports'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Latest reports appear first. Status badges flag low/high values vs. standard adult ranges • 
                Showing <span className="font-medium text-foreground">{reports.length}</span> 
                {reports.length === 1 ? ' report' : ' reports'}
                {effectiveClientId && ` for ${selectedClient?.name || 'selected client'}`}
              </p>
            </div>
          </div>
          <DataTable
            title=""
            tooltip=""
            columns={columns as any}
            data={reports}
            emptyMessage={isLoading ? 'Loading reports…' : 'No blood reports yet'}
          />
        </TabsContent>

        <TabsContent value="charts" className="space-y-6">
          {trendData.length === 0 ? (
            <Card className="shadow-card">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Select a client and add at least one report to see biomarker trends.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {TREND_MARKERS.map((key) => {
                const def = BLOOD_MARKER_MAP[key];
                const hasData = trendData.some((d: any) => d[key] !== null && d[key] !== undefined);
                return (
                  <Card key={key} className="shadow-card">
                    <CardHeader>
                      <CardTitle className="text-lg">{def.label} Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!hasData ? (
                        <p className="text-sm text-muted-foreground">No {def.label} data recorded yet.</p>
                      ) : (
                        <ChartContainer config={trendChartConfig} className="h-[260px] w-full aspect-auto">
                          <LineChart data={trendData}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="date" tickLine={false} axisLine={false} />
                            <YAxis tickLine={false} axisLine={false} width={42} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Line type="monotone" dataKey={key} stroke={`var(--color-${key})`} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                          </LineChart>
                        </ChartContainer>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BloodReportFormDialog
        open={formOpen}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }}
        report={editing}
        defaultClientId={effectiveClientId}
        onSubmit={editing ? handleUpdate : handleCreate}
        isLoading={createReport.isPending || updateReport.isPending}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Blood Report</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the report and its readings. This action cannot be undone.
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

export default BloodReports;

import { useMemo, useRef, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/dashboard/DataTable';
import { StatCard } from '@/components/dashboard/StatCard';
import { BodyMeasurementFormDialog } from '@/components/body-measurements/BodyMeasurementFormDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useActiveClients } from '@/hooks/useClients';
import { BodyMeasurementInput, BodyMeasurementWithClientName, useBodyMeasurements, useCreateBodyMeasurement, useDeleteBodyMeasurement, useUpdateBodyMeasurement } from '@/hooks/useBodyMeasurements';
import { Home, ChevronRight, Activity, Plus, Pencil, Trash2, Scale, Ruler, TrendingUp, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
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

// Fixed metric -> categorical chart-slot assignment (see index.css). Order
// matters for colorblind-safe separation — never reassign or cycle these.
const chartConfig = {
  weight: { label: 'Weight', color: 'hsl(var(--chart-1))' },
  bmi: { label: 'BMI', color: 'hsl(var(--chart-2))' },
  waist: { label: 'Waist', color: 'hsl(var(--chart-3))' },
  hip: { label: 'Hip', color: 'hsl(var(--chart-4))' },
  chest: { label: 'Chest', color: 'hsl(var(--chart-5))' },
  body_fat_percent: { label: 'Body Fat %', color: 'hsl(var(--chart-6))' },
  thigh: { label: 'Thigh', color: 'hsl(var(--chart-7))' },
  arm: { label: 'Arm', color: 'hsl(var(--chart-8))' },
  // Selector-only metrics (never plotted alongside the others at once, so
  // reusing a slot doesn't create an on-screen collision).
  neck: { label: 'Neck', color: 'hsl(var(--chart-1))' },
  calf: { label: 'Calf', color: 'hsl(var(--chart-2))' },
};

// Order the parameter picker follows; also the fixed draw order for the
// combined "Overall Progress" chart below.
const PARAMETER_OPTIONS: Array<{ key: keyof typeof chartConfig; unit: string }> = [
  { key: 'weight', unit: ' kg' },
  { key: 'bmi', unit: '' },
  { key: 'waist', unit: '' },
  { key: 'hip', unit: '' },
  { key: 'chest', unit: '' },
  { key: 'body_fat_percent', unit: '%' },
  { key: 'thigh', unit: '' },
  { key: 'arm', unit: '' },
  { key: 'neck', unit: '' },
  { key: 'calf', unit: '' },
];

// Metrics included in the combined "Overall Progress" chart — capped at the
// 8 validated categorical slots so a legend never has to invent a 9th hue.
const OVERALL_PROGRESS_METRICS = PARAMETER_OPTIONS.slice(0, 8).map((p) => p.key);

const downloadChartAsImage = async (node: HTMLElement | null, filename: string) => {
  if (!node) return;
  try {
    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: getComputedStyle(node).backgroundColor || '#ffffff',
    });
    const link = document.createElement('a');
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (error) {
    toast.error('Could not download the chart image.');
  }
};

const formatValue = (value: number | null | undefined, suffix = '') => value === null || value === undefined ? '—' : `${value}${suffix}`;
const formatDelta = (current: number | null | undefined, previous: number | null | undefined, suffix = '') => {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  const diff = Number((current - previous).toFixed(1));
  return { value: `${diff}${suffix}`, isPositive: diff > 0 };
};

const getLatestAndPrevious = (measurements: BodyMeasurementWithClientName[]) => {
  const [latest, previous] = measurements;
  return { latest, previous };
};

const BodyMeasurements = () => {
  const { data: clients = [] } = useActiveClients();
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [tab, setTab] = useState('history');
  const [formOpen, setFormOpen] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<BodyMeasurementWithClientName | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BodyMeasurementWithClientName | null>(null);

  const effectiveClientId = selectedClientId === 'all' ? undefined : selectedClientId;
  const { data: measurements = [], isLoading } = useBodyMeasurements(effectiveClientId);
  const createMeasurement = useCreateBodyMeasurement();
  const updateMeasurement = useUpdateBodyMeasurement();
  const deleteMeasurement = useDeleteBodyMeasurement();

  const selectedClient = clients.find((client) => client.id === effectiveClientId);

  const [selectedParameter, setSelectedParameter] = useState<keyof typeof chartConfig>('waist');
  const weightChartRef = useRef<HTMLDivElement>(null);
  const bmiChartRef = useRef<HTMLDivElement>(null);
  const parameterChartRef = useRef<HTMLDivElement>(null);
  const overallChartRef = useRef<HTMLDivElement>(null);

  const sortedAsc = useMemo(() => [...measurements].reverse(), [measurements]);
  const { latest, previous } = useMemo(() => getLatestAndPrevious(measurements), [measurements]);

  const chartData = useMemo(() => sortedAsc.map((entry) => ({
    date: new Date(entry.measurement_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    weight: entry.weight,
    bmi: entry.bmi,
    waist: entry.waist,
    hip: entry.hip,
    chest: entry.chest,
    body_fat_percent: entry.body_fat_percent,
    thigh: entry.thigh,
    arm: entry.arm,
    neck: entry.neck,
    calf: entry.calf,
  })), [sortedAsc]);

  const parameterLabel = chartConfig[selectedParameter].label;
  const parameterUnit = PARAMETER_OPTIONS.find((p) => p.key === selectedParameter)?.unit ?? '';

  // Indexed to each metric's first recorded value so weight (kg), BMI, and
  // circumference measurements (cm) can share one axis as "% change from
  // baseline" — plotting them at raw scale would need separate axes.
  const overallMetrics = useMemo(
    () => OVERALL_PROGRESS_METRICS.filter((key) => sortedAsc.some((entry) => entry[key] !== null && entry[key] !== undefined)),
    [sortedAsc],
  );

  const overallChartData = useMemo(() => {
    const baselines: Partial<Record<string, number>> = {};
    for (const key of overallMetrics) {
      const firstValue = sortedAsc.find((entry) => entry[key] !== null && entry[key] !== undefined)?.[key];
      if (firstValue) baselines[key] = firstValue as number;
    }
    return sortedAsc.map((entry) => {
      const point: Record<string, string | number | null> = {
        date: new Date(entry.measurement_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      };
      for (const key of overallMetrics) {
        const value = entry[key];
        const baseline = baselines[key];
        point[key] = value === null || value === undefined || !baseline ? null : Number((((value - baseline) / baseline) * 100).toFixed(1));
      }
      return point;
    });
  }, [sortedAsc, overallMetrics]);

  const handleCreate = async (data: BodyMeasurementInput) => {
    try {
      await createMeasurement.mutateAsync(data);
      toast.success('Measurement added successfully!');
      setFormOpen(false);
    } catch (error) {
    }
  };

  const handleUpdate = async (data: BodyMeasurementInput) => {
    if (!editingMeasurement) return;
    try {
      await updateMeasurement.mutateAsync({ id: editingMeasurement.id, client_id: editingMeasurement.client_id, ...data });
      toast.success('Measurement updated successfully!');
      setEditingMeasurement(null);
      setFormOpen(false);
    } catch (error) {
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMeasurement.mutateAsync({ id: deleteTarget.id, clientId: deleteTarget.client_id });
      toast.success('Measurement deleted successfully!');
      setDeleteTarget(null);
    } catch (error) {
    }
  };

  const columns = [
    {
      key: 'measurement_date',
      header: 'Date',
      render: (item: BodyMeasurementWithClientName) => new Date(item.measurement_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    ...(effectiveClientId ? [] : [{
      key: 'client_name',
      header: 'Client',
      render: (item: BodyMeasurementWithClientName) => <span className="font-medium text-primary">{item.client_name}</span>,
    }]),
    { key: 'weight', header: 'Weight', render: (item: BodyMeasurementWithClientName) => formatValue(item.weight, ' kg') },
    { key: 'bmi', header: 'BMI', render: (item: BodyMeasurementWithClientName) => formatValue(item.bmi) },
    { key: 'waist', header: 'Waist', render: (item: BodyMeasurementWithClientName) => formatValue(item.waist) },
    { key: 'hip', header: 'Hip', render: (item: BodyMeasurementWithClientName) => formatValue(item.hip) },
    {
      key: 'notes',
      header: 'Notes',
      render: (item: BodyMeasurementWithClientName) => item.notes ? (
        <Badge variant="secondary" className="max-w-[160px] truncate">{item.notes}</Badge>
      ) : '—',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: BodyMeasurementWithClientName) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => { setEditingMeasurement(item); setFormOpen(true); }}>
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
        <span className="text-foreground font-medium">Body Measurements</span>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Body Measurements</h1>
            <p className="text-sm text-muted-foreground">Track client progress over time with dated measurement entries.</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger className="w-full sm:w-[240px]">
              <SelectValue placeholder="Filter by client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="gradient-primary text-primary-foreground" onClick={() => { setEditingMeasurement(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Measurement
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard title="Latest Weight" value={formatValue(latest?.weight, ' kg')} subtitle={latest?.client_name || 'No client'} change={formatDelta(latest?.weight, previous?.weight, ' kg') || undefined} icon={<Scale className="h-5 w-5" />} />
        <StatCard title="Latest BMI" value={formatValue(latest?.bmi)} subtitle="Compared with previous entry" change={formatDelta(latest?.bmi, previous?.bmi) || undefined} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Waist" value={formatValue(latest?.waist)} subtitle="Latest recorded value" change={formatDelta(latest?.waist, previous?.waist) || undefined} icon={<Ruler className="h-5 w-5" />} />
        <StatCard title="Entries" value={measurements.length} subtitle={latest ? `Last updated ${new Date(latest.measurement_date).toLocaleDateString('en-IN')}` : 'No measurements yet'} icon={<Activity className="h-5 w-5" />} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="charts">Progress Charts</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {effectiveClientId ? `${selectedClient?.name || 'Client'} Measurement History` : 'Measurement History'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Latest entries appear first so follow-up visits are easy to review • 
                Showing <span className="font-medium text-foreground">{measurements.length}</span> 
                {measurements.length === 1 ? ' measurement' : ' measurements'}
                {effectiveClientId && ` for ${selectedClient?.name || 'selected client'}`}
              </p>
            </div>
          </div>
          <DataTable
            title=""
            tooltip=""
            columns={columns as any}
            data={measurements}
            emptyMessage={isLoading ? 'Loading measurements...' : 'No measurements found'}
          />
        </TabsContent>

        <TabsContent value="charts" className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card className="shadow-card" ref={weightChartRef}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">Weight Trend</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  disabled={chartData.length === 0}
                  onClick={() => downloadChartAsImage(weightChartRef.current, `${selectedClient?.name || 'all-clients'}-weight-trend`)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? <p className="text-sm text-muted-foreground">Select a client or add measurements to view trends.</p> : (
                  <ChartContainer config={chartConfig} className="h-[280px] w-full aspect-auto">
                    <LineChart data={chartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={42} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="weight" stroke="var(--color-weight)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-card" ref={bmiChartRef}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">BMI Trend</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  disabled={chartData.length === 0}
                  onClick={() => downloadChartAsImage(bmiChartRef.current, `${selectedClient?.name || 'all-clients'}-bmi-trend`)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? <p className="text-sm text-muted-foreground">BMI data will appear here once recorded.</p> : (
                  <ChartContainer config={chartConfig} className="h-[280px] w-full aspect-auto">
                    <LineChart data={chartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={42} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="bmi" stroke="var(--color-bmi)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-card" ref={parameterChartRef}>
            <CardHeader className="flex-row items-center justify-between space-y-0 gap-4 flex-wrap">
              <div>
                <CardTitle className="text-lg">Progress by Parameter</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedParameter} onValueChange={(value) => setSelectedParameter(value as keyof typeof chartConfig)}>
                  <SelectTrigger className="w-[160px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARAMETER_OPTIONS.map(({ key }) => (
                      <SelectItem key={key} value={key}>{chartConfig[key].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  disabled={chartData.length === 0}
                  onClick={() => downloadChartAsImage(parameterChartRef.current, `${selectedClient?.name || 'all-clients'}-${selectedParameter}-trend`)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? <p className="text-sm text-muted-foreground">Add dated measurements to see this parameter's trend.</p> : (
                <ChartContainer config={chartConfig} className="h-[320px] w-full aspect-auto">
                  <LineChart data={chartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={42} unit={parameterUnit} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey={selectedParameter}
                      name={String(parameterLabel)}
                      stroke={`var(--color-${selectedParameter})`}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card" ref={overallChartRef}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">Overall Progress</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Every tracked measurement, shown as % change from its first recorded value.</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                disabled={overallChartData.length === 0}
                onClick={() => downloadChartAsImage(overallChartRef.current, `${selectedClient?.name || 'all-clients'}-overall-progress`)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {overallChartData.length === 0 ? <p className="text-sm text-muted-foreground">Add at least two dated measurements to see overall progress.</p> : (
                <ChartContainer config={chartConfig} className="h-[360px] w-full aspect-auto">
                  <LineChart data={overallChartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={48} unit="%" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    {overallMetrics.map((key) => (
                      <Line
                        key={key}
                        type="monotone"
                        dataKey={key}
                        name={String(chartConfig[key].label)}
                        stroke={`var(--color-${key})`}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <BodyMeasurementFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingMeasurement(null); }}
        measurement={editingMeasurement}
        defaultClientId={effectiveClientId}
        onSubmit={editingMeasurement ? handleUpdate : handleCreate}
        isLoading={createMeasurement.isPending || updateMeasurement.isPending}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Measurement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this dated measurement entry? This action cannot be undone.
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

export default BodyMeasurements;
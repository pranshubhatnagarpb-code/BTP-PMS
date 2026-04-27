import { useMemo, useState } from 'react';
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
import { Home, ChevronRight, Activity, Plus, Pencil, Trash2, Scale, Ruler, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { Line, LineChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

const chartConfig = {
  weight: { label: 'Weight', color: 'hsl(var(--primary))' },
  bmi: { label: 'BMI', color: 'hsl(var(--success))' },
  waist: { label: 'Waist', color: 'hsl(var(--warning))' },
  hip: { label: 'Hip', color: 'hsl(var(--primary))' },
  chest: { label: 'Chest', color: 'hsl(var(--muted-foreground))' },
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

  const sortedAsc = useMemo(() => [...measurements].reverse(), [measurements]);
  const { latest, previous } = useMemo(() => getLatestAndPrevious(measurements), [measurements]);

  const chartData = useMemo(() => sortedAsc.map((entry) => ({
    date: new Date(entry.measurement_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    weight: entry.weight,
    bmi: entry.bmi,
    waist: entry.waist,
    hip: entry.hip,
    chest: entry.chest,
  })), [sortedAsc]);

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
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Weight Trend</CardTitle>
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

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">BMI Trend</CardTitle>
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

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="text-lg">Waist / Hip / Chest Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? <p className="text-sm text-muted-foreground">Add dated measurements to compare circumference changes over time.</p> : (
                <ChartContainer config={chartConfig} className="h-[320px] w-full aspect-auto">
                  <BarChart data={chartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={42} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="waist" fill="var(--color-waist)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="hip" fill="var(--color-hip)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="chest" fill="var(--color-chest)" radius={[4, 4, 0, 0]} />
                  </BarChart>
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
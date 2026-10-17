import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/dashboard/DataTable';
import { Home, ChevronRight, Plus, Pencil, Trash2, Search, X, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useClients, useCreateClient, useUpdateClient, useDeleteClient, useClientsWithDietData, Client, ClientWithDietData } from '@/hooks/useClients';
import { calculateDietProgress, calculateExpiryStatus, getExpiryColorClasses } from '@/lib/clientDietUtils';
import { StatusDot } from '@/components/ui/StatusDot';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateBill } from '@/hooks/useBills';
import { useQueryClient } from '@tanstack/react-query';
import { ClientFormDialog } from '@/components/clients/ClientFormDialog';
import type { ClientFormSubmission } from '@/components/clients/ClientFormDialog';
import { PortalAccessDialog } from '@/components/clients/PortalAccessDialog';
import { ClientNotesDialog } from '@/components/clients/ClientNotesDialog';
import { IntakeResponseDialog } from '@/components/clients/IntakeResponseDialog';
import { usePortalStatus } from '@/hooks/useClientPortal';
import { useCreateBodyMeasurement } from '@/hooks/useBodyMeasurements';
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

// This clinic isn't being given client portal access yet — flip to true to
// bring back the "Portal" column and its Enable/Enabled button.
const CLIENT_PORTAL_ENABLED = false;

const CATEGORY_BADGES: Record<string, { label: string; className: string }> = {
  standard: { label: 'Standard', className: 'bg-secondary text-secondary-foreground border-transparent' },
  premium: { label: 'Premium', className: 'bg-warning/15 text-warning border-warning/30' },
  premium_plus: { label: 'Premium Plus', className: 'bg-primary/15 text-primary border-primary/30' },
};

const Clients = () => {
  const { data: clients = [], isLoading } = useClientsWithDietData();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const createBill = useCreateBill();
  const createBodyMeasurement = useCreateBodyMeasurement();
  const { data: portalClientIds } = usePortalStatus();
  const queryClient = useQueryClient();

  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expiryFilter, setExpiryFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [portalDialogOpen, setPortalDialogOpen] = useState(false);
  const [portalClient, setPortalClient] = useState<Client | null>(null);

  const openPortalDialog = (client: Client) => {
    setPortalClient(client);
    setPortalDialogOpen(true);
  };

  const handleCreate = async ({ client, initialMeasurement }: ClientFormSubmission) => {
    try {
      // Create the client first
      const newClient = await createClient.mutateAsync(client as any);

      if (initialMeasurement) {
        await createBodyMeasurement.mutateAsync({
          client_id: newClient.id,
          measurement_date: initialMeasurement.measurement_date || newClient.created_at.split('T')[0],
          weight: initialMeasurement.weight ?? null,
          bmi: initialMeasurement.bmi ?? null,
          body_fat_percent: initialMeasurement.body_fat_percent ?? null,
          waist: initialMeasurement.waist ?? null,
          hip: initialMeasurement.hip ?? null,
          chest: initialMeasurement.chest ?? null,
          thigh: initialMeasurement.thigh ?? null,
          arm: initialMeasurement.arm ?? null,
          neck: initialMeasurement.neck ?? null,
          calf: initialMeasurement.calf ?? null,
          notes: initialMeasurement.notes ?? null,
        });
      }
      
      // Automatically create a bill if total fees > 0
      if (client.total_fees && client.total_fees > 0) {
        const billData = {
          client_id: newClient.id,
          amount: client.total_fees,
          due_date: client.service_start_date || new Date().toISOString().split('T')[0],
          service_name: 'Client Onboarding - Dietitian Services',
          status: client.total_receivables && client.total_receivables > 0 ? 'pending' : 'paid',
          paid_amount: client.total_fees - (client.total_receivables || 0),
          notes: 'Automatically generated bill during client onboarding',
        };
        
        await createBill.mutateAsync(billData);
        toast.success('Client and initial bill created successfully!');
      } else {
        toast.success('Client added successfully!');
      }
      
      setFormOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleUpdate = async ({ client }: ClientFormSubmission) => {
    if (!editingClient) return;
    try {
      await updateClient.mutateAsync({ id: editingClient.id, ...(client as any) });
      
      // Check if billing information changed and create a new bill if needed
      const feesChanged = client.total_fees !== editingClient.total_fees;
      const receivablesChanged = client.total_receivables !== editingClient.total_receivables;
      
      if (feesChanged || receivablesChanged) {
        // Create a new bill entry if total fees > 0
        if (client.total_fees && client.total_fees > 0) {
          const billData = {
            client_id: editingClient.id,
            amount: client.total_fees,
            due_date: client.service_start_date || new Date().toISOString().split('T')[0],
            service_name: 'Updated Billing - Dietitian Services',
            status: client.total_receivables && client.total_receivables > 0 ? 'pending' : 'paid',
            paid_amount: client.total_fees - (client.total_receivables || 0),
            notes: 'Bill generated due to client billing information update',
          };
          
          await createBill.mutateAsync(billData);
          toast.success('Client updated and new bill created successfully!');
        } else {
          toast.success('Client updated successfully!');
        }
      } else {
        toast.success('Client updated successfully!');
      }
      
      setEditingClient(null);
      setFormOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDelete = async () => {
    if (!clientToDelete) return;
    try {
      await deleteClient.mutateAsync(clientToDelete.id);
      
      // Invalidate bills query to remove bills for deleted client
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      
      toast.success('Client deleted successfully!');
      setClientToDelete(null);
      setDeleteDialogOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const openEditDialog = (client: Client) => {
    setEditingClient(client);
    setFormOpen(true);
  };

  const openDeleteDialog = (client: Client) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  // Filter clients based on search term and expiry status
  const filteredClients = useMemo(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return (clients as ClientWithDietData[]).filter(client => {
      const matchesSearch =
        client.name.toLowerCase().includes(lowerSearchTerm) ||
        client.client_code?.toLowerCase().includes(lowerSearchTerm) ||
        client.phone?.includes(searchTerm) ||
        client.email?.toLowerCase().includes(lowerSearchTerm) ||
        client.goal?.toLowerCase().includes(lowerSearchTerm) ||
        (client.is_active ? 'active' : 'inactive').includes(lowerSearchTerm);

      if (!matchesSearch) return false;
      // Clients without a category show as Standard, so filter them the same way.
      if (categoryFilter !== 'all' && (client.category || 'standard') !== categoryFilter) return false;
      if (expiryFilter === 'all') return true;

      const expiryColor = calculateExpiryStatus(client).color;
      return expiryColor === expiryFilter;
    });
  }, [clients, searchTerm, expiryFilter, categoryFilter]);

  // Clear search function
  const clearSearch = () => {
    setSearchTerm('');
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (item: Client) => (
        <div className="flex items-center">
          <div>
            <span
              className="text-primary font-medium cursor-pointer hover:underline"
              onClick={() => openEditDialog(item)}
            >
              {item.name}
            </span>
            {item.address_as && (
              <div className="text-xs text-muted-foreground">Address as: {item.address_as}</div>
            )}
          </div>
          <ClientNotesDialog clientId={item.id} clientName={item.name} />
          <IntakeResponseDialog clientId={item.id} clientName={item.name} />
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (item: Client) => {
        const badge = CATEGORY_BADGES[item.category] ?? CATEGORY_BADGES.standard;
        return <Badge variant="outline" className={badge.className}>{badge.label}</Badge>;
      },
    },
    { key: 'phone', header: 'Phone' },
    {
      key: 'email',
      header: 'Email',
      render: (item: Client) => (
        <div className="max-w-40 break-words">
          {item.email || '-'}
        </div>
      ),
    },
    {
      key: 'goal',
      header: 'Goal',
      render: (item: Client) => (
        <span className="capitalize">{item.goal?.replace('_', ' ') || '-'}</span>
      ),
    },
    {
      key: 'charts_progress',
      header: 'Charts Progress',
      render: (item: ClientWithDietData) => {
        const progress = calculateDietProgress(item);
        return (
          <span className="font-medium text-sm">
            {progress.display}
          </span>
        );
      },
    },
    {
      key: 'expiry_status',
      header: 'Expiry Status',
      render: (item: ClientWithDietData) => {
        const expiryStatus = calculateExpiryStatus(item);
        return (
          <div className="flex items-center gap-2">
            <StatusDot color={expiryStatus.color} size="lg" />
            <span className="text-xs text-muted-foreground">
              {expiryStatus.display}
            </span>
          </div>
        );
      },
    },
    {
      key: 'total_fees',
      header: 'Total Fees',
      render: (item: Client) => (
        <span className="font-medium">₹{(item.total_fees || 0).toLocaleString()}</span>
      ),
    },
    {
      key: 'total_receivables',
      header: 'Balance',
      render: (item: Client) => (
        <span className={`font-medium ${(item.total_receivables || 0) > 0 ? 'text-destructive' : 'text-green-600'}`}>
          ₹{(item.total_receivables || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (item: Client) => (
        <Badge variant={item.is_active ? 'default' : 'secondary'}>
          {item.is_active ? 'active' : 'inactive'}
        </Badge>
      ),
    },
    ...(CLIENT_PORTAL_ENABLED ? [{
      key: 'portal',
      header: 'Portal',
      render: (item: Client) => {
        const enabled = portalClientIds?.has(item.id) ?? false;
        return (
          <Button
            variant={enabled ? 'outline' : 'ghost'}
            size="sm"
            className={enabled ? 'gap-1.5 text-success border-success/30 hover:text-success' : 'gap-1.5 text-muted-foreground'}
            onClick={() => openPortalDialog(item)}
          >
            {enabled ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
            {enabled ? 'Enabled' : 'Enable Portal'}
          </Button>
        );
      },
    }] : []),
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Client) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(item)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Clients</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Clients</h1>
        <Button 
          className="gradient-primary text-primary-foreground"
          onClick={() => { setEditingClient(null); setFormOpen(true); }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search clients by name, phone, email, goal, or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              onClick={clearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground">Category:</span>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {Object.entries(CATEGORY_BADGES).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-sm text-muted-foreground">Plan expiry Filter:</span>
          <Select value={expiryFilter} onValueChange={setExpiryFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="green">Green (≥4 days)</SelectItem>
              <SelectItem value="yellow">Yellow (3 days)</SelectItem>
              <SelectItem value="red">Red (1-2 days)</SelectItem>
              <SelectItem value="black">Black (expired)</SelectItem>
              <SelectItem value="blue">Dark Blue (on pause)</SelectItem>
              <SelectItem value="grey">Grey (no plan)</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-3 text-xs text-muted-foreground border-l pl-3">
            {[
              { color: 'bg-green-500', label: 'Safe (>2 days)' },
              { color: 'bg-yellow-500', label: '2 days left' },
              { color: 'bg-red-500', label: '1 day left' },
              { color: 'bg-black', label: 'Expired' },
              { color: 'bg-blue-800', label: 'On Pause' },
              { color: 'bg-gray-400', label: 'No plan' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {searchTerm ? "Search Results" : "All Clients"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {searchTerm ? "Clients matching your search criteria" : "List of all registered clients"} • 
            Showing <span className="font-medium text-foreground">{filteredClients.length}</span> 
            {filteredClients.length === 1 ? ' client' : ' clients'}
            {expiryFilter !== 'all' && ` with ${expiryFilter} expiry status`}
          </p>
        </div>
      </div>

      <DataTable
        title=""
        tooltip=""
        columns={columns}
        data={filteredClients}
        emptyMessage={isLoading ? "Loading clients..." : searchTerm ? "No clients found matching your search" : "No clients found"}
      />

      <ClientFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingClient(null); }}
        client={editingClient}
        onSubmit={editingClient ? handleUpdate : handleCreate}
         isLoading={createClient.isPending || updateClient.isPending || createBill.isPending || createBodyMeasurement.isPending}
      />

      <PortalAccessDialog
        open={portalDialogOpen}
        onOpenChange={(open) => { setPortalDialogOpen(open); if (!open) setPortalClient(null); }}
        client={portalClient}
        isEnabled={!!portalClient && (portalClientIds?.has(portalClient.id) ?? false)}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {clientToDelete?.name}? This action cannot be undone.
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

export default Clients;

import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/dashboard/DataTable';
import { Home, ChevronRight, Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useClients, useCreateClient, useUpdateClient, useDeleteClient, Client } from '@/hooks/useClients';
import { useCreateBill } from '@/hooks/useBills';
import { useQueryClient } from '@tanstack/react-query';
import { ClientFormDialog } from '@/components/clients/ClientFormDialog';
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

const Clients = () => {
  const { data: clients = [], isLoading } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const createBill = useCreateBill();
  const queryClient = useQueryClient();
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleCreate = async (data: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      // Create the client first
      const newClient = await createClient.mutateAsync(data);
      
      // Automatically create a bill if total fees > 0
      if (data.total_fees && data.total_fees > 0) {
        const billData = {
          client_id: newClient.id,
          amount: data.total_fees,
          due_date: data.service_start_date || new Date().toISOString().split('T')[0],
          service_name: 'Client Onboarding - Dietitian Services',
          status: data.total_receivables && data.total_receivables > 0 ? 'pending' : 'paid',
          paid_amount: data.total_fees - (data.total_receivables || 0),
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

  const handleUpdate = async (data: Omit<Client, 'id' | 'created_at' | 'updated_at'>) => {
    if (!editingClient) return;
    try {
      await updateClient.mutateAsync({ id: editingClient.id, ...data });
      
      // Check if billing information changed and create a new bill if needed
      const feesChanged = data.total_fees !== editingClient.total_fees;
      const receivablesChanged = data.total_receivables !== editingClient.total_receivables;
      
      if (feesChanged || receivablesChanged) {
        // Create a new bill entry if total fees > 0
        if (data.total_fees && data.total_fees > 0) {
          const billData = {
            client_id: editingClient.id,
            amount: data.total_fees,
            due_date: data.service_start_date || new Date().toISOString().split('T')[0],
            service_name: 'Updated Billing - Dietitian Services',
            status: data.total_receivables && data.total_receivables > 0 ? 'pending' : 'paid',
            paid_amount: data.total_fees - (data.total_receivables || 0),
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

  // Filter clients based on search term
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return clients;
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return clients.filter(client => 
      client.name.toLowerCase().includes(lowerSearchTerm) ||
      client.phone?.includes(searchTerm) ||
      client.email?.toLowerCase().includes(lowerSearchTerm) ||
      client.goal?.toLowerCase().includes(lowerSearchTerm) ||
      (client.is_active ? 'active' : 'inactive').includes(lowerSearchTerm)
    );
  }, [clients, searchTerm]);

  // Clear search function
  const clearSearch = () => {
    setSearchTerm('');
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (item: Client) => (
        <span 
          className="text-primary font-medium cursor-pointer hover:underline"
          onClick={() => openEditDialog(item)}
        >
          {item.name}
        </span>
      ),
    },
    { key: 'phone', header: 'Phone' },
    { key: 'email', header: 'Email' },
    {
      key: 'goal',
      header: 'Goal',
      render: (item: Client) => (
        <span className="capitalize">{item.goal?.replace('_', ' ') || '-'}</span>
      ),
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

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
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
              size="sm"
              onClick={clearSearch}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {searchTerm && (
          <p className="text-sm text-muted-foreground mt-2">
            Found {filteredClients.length} of {clients.length} clients
          </p>
        )}
      </div>

      <DataTable
        title={searchTerm ? "Search Results" : "All Clients"}
        tooltip={searchTerm ? "Clients matching your search criteria" : "List of all registered clients"}
        columns={columns}
        data={filteredClients}
        emptyMessage={isLoading ? "Loading clients..." : searchTerm ? "No clients found matching your search" : "No clients found"}
      />

      <ClientFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingClient(null); }}
        client={editingClient}
        onSubmit={editingClient ? handleUpdate : handleCreate}
        isLoading={createClient.isPending || updateClient.isPending || createBill.isPending}
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

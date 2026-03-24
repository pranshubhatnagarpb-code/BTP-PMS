import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DataTable } from '@/components/dashboard/DataTable';
import { Home, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBills, useCreateBill, useUpdateBill, useDeleteBill, BillWithClientName } from '@/hooks/useBills';
import { BillFormDialog } from '@/components/bills/BillFormDialog';
import { useState } from 'react';
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

const Bills = () => {
  const { data: bills = [], isLoading } = useBills();
  const createBill = useCreateBill();
  const updateBill = useUpdateBill();
  const deleteBill = useDeleteBill();
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<BillWithClientName | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<string | null>(null);
  const handleCreate = async (data: any) => {
    try {
      await createBill.mutateAsync(data);
      toast.success('Bill created successfully!');
      setFormOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editingBill) return;
    try {
      await updateBill.mutateAsync({ id: editingBill.id, ...data });
      toast.success('Bill updated successfully!');
      setFormOpen(false);
      setEditingBill(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDelete = async () => {
    if (!billToDelete) return;
    try {
      await deleteBill.mutateAsync(billToDelete);
      toast.success('Bill deleted successfully!');
      setBillToDelete(null);
      setDeleteDialogOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const openEditDialog = (bill: BillWithClientName) => {
    setEditingBill(bill);
    setFormOpen(true);
  };

  const openDeleteDialog = (id: string) => {
    setBillToDelete(id);
    setDeleteDialogOpen(true);
  };

  const columns = [
    {
      key: 'client_name',
      header: 'Client Name',
      render: (item: BillWithClientName) => (
        <span className="text-primary font-medium">{item.client_name}</span>
      ),
    },
    {
      key: 'service_name',
      header: 'Service',
      render: (item: BillWithClientName) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.service_name}</span>
          {item.notes?.includes('Automatically generated') && (
            <Badge variant="outline" className="text-xs">
              Auto-generated
            </Badge>
          )}
          {item.notes?.includes('billing information update') && (
            <Badge variant="secondary" className="text-xs">
              Updated
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (item: BillWithClientName) => (
        <span className="font-medium">₹{item.amount.toLocaleString()}</span>
      ),
    },
    {
      key: 'paid_amount',
      header: 'Paid',
      render: (item: BillWithClientName) => (
        <span className="font-medium">₹{(item.paid_amount || 0).toLocaleString()}</span>
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      render: (item: BillWithClientName) => (
        <span>{new Date(item.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: BillWithClientName) => (
        <Badge variant={item.status === 'paid' ? 'default' : item.status === 'overdue' ? 'destructive' : 'secondary'}>
          {item.status}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: BillWithClientName) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(item.id)}>
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
        <span className="text-foreground font-medium">Bills Collection</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Bills Collection</h1>
        <Button 
          className="gradient-primary text-primary-foreground"
          onClick={() => { setEditingBill(null); setFormOpen(true); }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Bill
        </Button>
      </div>

      <DataTable
        title="All Bills"
        tooltip="List of all bills"
        columns={columns}
        data={bills}
        emptyMessage="No bills found"
      />

      <BillFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingBill(null); }}
        bill={editingBill}
        onSubmit={editingBill ? handleUpdate : handleCreate}
        isLoading={createBill.isPending || updateBill.isPending}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the bill.
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

export default Bills;

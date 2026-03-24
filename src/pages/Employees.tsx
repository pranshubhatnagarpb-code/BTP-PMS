import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Home, ChevronRight, Plus, Phone, Mail, Briefcase, Pencil, Trash2, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee, useEmployeeClients, Employee } from '@/hooks/useEmployees';
import { toast } from 'sonner';

interface EmployeeFormData {
  name: string;
  role: string;
  department: string;
  phone: string;
  email: string;
  is_active: boolean;
}

const emptyForm: EmployeeFormData = {
  name: '', role: '', department: '', phone: '', email: '', is_active: true,
};

const Employees = () => {
  const { data: employees = [], isLoading } = useEmployees();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<EmployeeFormData>(emptyForm);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [clientsSheetOpen, setClientsSheetOpen] = useState(false);

  const { data: assignedClients = [] } = useEmployeeClients(selectedEmployee?.id || null);

  const openCreateDialog = () => {
    setEditingEmployee(null);
    setFormData(emptyForm);
    setFormOpen(true);
  };

  const openEditDialog = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name,
      role: emp.role,
      department: emp.department || '',
      phone: emp.phone || '',
      email: emp.email || '',
      is_active: emp.is_active,
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: formData.name.trim(),
      role: formData.role.trim() || 'Staff',
      department: formData.department.trim() || null,
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      is_active: formData.is_active,
    };
    try {
      if (editingEmployee) {
        await updateEmployee.mutateAsync({ id: editingEmployee.id, ...payload });
        toast.success('Employee updated!');
      } else {
        await createEmployee.mutateAsync(payload);
        toast.success('Employee added!');
      }
      setFormOpen(false);
    } catch {}
  };

  const handleDelete = async () => {
    if (!employeeToDelete) return;
    try {
      await deleteEmployee.mutateAsync(employeeToDelete.id);
      toast.success('Employee deleted!');
      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
    } catch {}
  };

  const viewClients = (emp: Employee) => {
    setSelectedEmployee(emp);
    setClientsSheetOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Employees</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Employees</h1>
        <Button className="gradient-primary text-primary-foreground" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Employee
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading employees...</p>
      ) : employees.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">No employees found. Add your first employee to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((employee) => (
            <Card key={employee.id} className="p-6 shadow-card hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-lg">
                      {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-foreground">{employee.name}</h3>
                    <p className="text-sm text-muted-foreground">{employee.role}</p>
                  </div>
                </div>
                <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                  {employee.is_active ? 'active' : 'inactive'}
                </Badge>
              </div>
              <div className="space-y-2 mb-4">
                {employee.department && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    <span>{employee.department}</span>
                  </div>
                )}
                {employee.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{employee.phone}</span>
                  </div>
                )}
                {employee.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{employee.email}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 border-t border-border pt-3">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => viewClients(employee)}>
                  <Users className="h-4 w-4 mr-1" />
                  View Clients
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEditDialog(employee)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setEmployeeToDelete(employee); setDeleteDialogOpen(true); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="emp-name">Name *</Label>
              <Input id="emp-name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emp-role">Role *</Label>
                <Input id="emp-role" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} placeholder="e.g., Dietitian" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-dept">Department</Label>
                <Input id="emp-dept" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} placeholder="e.g., Clinical" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emp-phone">Phone</Label>
                <Input id="emp-phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emp-email">Email</Label>
                <Input id="emp-email" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="emp-active" checked={formData.is_active} onCheckedChange={c => setFormData({ ...formData, is_active: c })} />
              <Label htmlFor="emp-active">Active</Label>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createEmployee.isPending || updateEmployee.isPending || !formData.name.trim()}>
                {editingEmployee ? 'Update' : 'Add'} Employee
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {employeeToDelete?.name}? Clients assigned to this employee will be unassigned.
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

      {/* Assigned Clients Sheet */}
      <Sheet open={clientsSheetOpen} onOpenChange={setClientsSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>Clients assigned to {selectedEmployee?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {assignedClients.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No clients assigned to this employee yet.</p>
            ) : (
              assignedClients.map((client: any) => (
                <Card key={client.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{client.name}</p>
                      <p className="text-sm text-muted-foreground">{client.phone || client.email || 'No contact'}</p>
                    </div>
                    <Badge variant={client.is_active ? 'default' : 'secondary'}>
                      {client.is_active ? 'active' : 'inactive'}
                    </Badge>
                  </div>
                </Card>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
};

export default Employees;

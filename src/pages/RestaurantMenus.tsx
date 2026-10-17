import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Home, ChevronRight, Store, Plus, Search, MapPin, RefreshCw, Trash2, Salad } from 'lucide-react';
import { RestaurantMenu, useDeleteRestaurantMenu, useRestaurantMenus } from '@/hooks/useRestaurantMenus';
import { RestaurantMenuUploadDialog } from '@/components/restaurant-menus/RestaurantMenuUploadDialog';
import { RestaurantMenuDetailDialog } from '@/components/restaurant-menus/RestaurantMenuDetailDialog';

const RestaurantMenus = () => {
  const { data: menus = [], isLoading } = useRestaurantMenus();
  const deleteMenu = useDeleteRestaurantMenu();

  const [searchTerm, setSearchTerm] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reanalyzeTarget, setReanalyzeTarget] = useState<RestaurantMenu | null>(null);
  const [detailMenu, setDetailMenu] = useState<RestaurantMenu | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RestaurantMenu | null>(null);

  const filteredMenus = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return menus.filter((m) => m.restaurant_name.toLowerCase().includes(term) || m.location?.toLowerCase().includes(term));
  }, [menus, searchTerm]);

  const openUpload = (prefill?: RestaurantMenu) => {
    setReanalyzeTarget(prefill || null);
    setUploadOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMenu.mutateAsync(deleteTarget.id);
      toast.success('Restaurant menu removed');
      setDeleteTarget(null);
    } catch {
      // Error already toasted in the hook
    }
  };

  return (
    <DashboardLayout>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Home className="h-4 w-4" />
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground font-medium">Restaurant Menus</span>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div className="flex items-center gap-3">
          <Store className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Restaurant Menus</h1>
            <p className="text-sm text-muted-foreground">
              Upload a menu once — AI picks out the healthy options and saves them here for next time.
            </p>
          </div>
        </div>
        <Button className="gradient-primary text-primary-foreground" onClick={() => openUpload()}>
          <Plus className="h-4 w-4 mr-2" />
          Analyze New Menu
        </Button>
      </div>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search restaurants by name or location..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">Loading restaurant menus...</CardContent>
        </Card>
      ) : filteredMenus.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Store className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">
              {menus.length === 0 ? 'No restaurant menus analyzed yet' : 'No restaurants match your search'}
            </p>
            {menus.length === 0 && (
              <p className="text-sm text-muted-foreground mt-1">Upload a menu photo to get started</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMenus.map((menu) => (
            <Card key={menu.id} className="shadow-card cursor-pointer hover:shadow-card-hover transition-shadow" onClick={() => setDetailMenu(menu)}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{menu.restaurant_name}</CardTitle>
                {menu.location && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {menu.location}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1.5 text-sm text-success mb-3">
                  <Salad className="h-4 w-4" />
                  <span>{menu.healthy_options.length} healthy option{menu.healthy_options.length === 1 ? '' : 's'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs">
                    Updated {formatDistanceToNow(new Date(menu.updated_at), { addSuffix: true })}
                  </Badge>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Re-analyze menu" onClick={() => openUpload(menu)}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Delete" onClick={() => setDeleteTarget(menu)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RestaurantMenuUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        existingMenus={menus}
        prefill={reanalyzeTarget}
        onAnalyzed={(saved) => setDetailMenu(saved)}
      />

      <RestaurantMenuDetailDialog open={!!detailMenu} onOpenChange={(open) => !open && setDetailMenu(null)} menu={detailMenu} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Restaurant Menu</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the saved healthy options for {deleteTarget?.restaurant_name}? You'll need to re-upload and re-analyze the menu to get them back.
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

export default RestaurantMenus;

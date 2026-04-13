import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  
  Receipt,
  FileText,
  UserCog,
  Utensils,
  ChefHat,
  CalendarDays,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from './DashboardLayout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const navItems = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { title: 'Clients', icon: Users, path: '/clients' },
  { title: 'Appointments', icon: CalendarDays, path: '/appointments' },
  
  { title: 'Diet Section', icon: Utensils, path: '/diet-section' },
  { title: 'Bills Collection', icon: Receipt, path: '/bills' },
  { title: 'Diet Chart Templates', icon: FileText, path: '/templates' },
  { title: 'Employee', icon: UserCog, path: '/employees' },
  { title: 'AI Recipes', icon: ChefHat, path: '/recipes' },
];

export const AppSidebar = () => {
  const { logout, user } = useAuth();
  const { isSidebarOpen, setIsSidebarOpen } = useSidebar();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Desktop menu button (shown when sidebar is closed) */}
      {!isSidebarOpen && (
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 left-4 z-50 hidden lg:flex"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          title="Open Sidebar"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 bg-card border-r border-border transition-transform duration-300",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          isSidebarOpen ? "lg:translate-x-0" : "lg:-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src="/NHZ LOGO.png" 
                  alt="NHZ Logo" 
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <h1 className="font-semibold text-foreground text-sm">NUTRITION</h1>
                  <p className="text-xs text-muted-foreground">HAI ZARURI</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:flex h-8 w-8"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                title="Close Sidebar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-card"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.title}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* User & Logout */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <span className="text-sm font-medium text-secondary-foreground">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground truncate max-w-[120px]">
                  {user?.email?.split('@')[0] || 'User'}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={logout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};

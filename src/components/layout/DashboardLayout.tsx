import { ReactNode, createContext, useContext, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { clinic } from '@/config/clinic';

interface SidebarContextType {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a DashboardLayout');
  }
  return context;
};

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { isAuthenticated } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SidebarContext.Provider value={{ isSidebarOpen, setIsSidebarOpen }}>
      <div className="min-h-screen bg-background flex flex-col">
        <AppSidebar />
        <main className={`flex-1 transition-all duration-300 ${
          isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
        }`}>
          <div className="p-4 lg:p-8 pt-16 lg:pt-8">
            {children}
          </div>
        </main>
        <footer className={`transition-all duration-300 border-t border-border bg-card/50 ${
          isSidebarOpen ? 'lg:ml-64' : 'lg:ml-0'
        }`}>
          <div className="px-4 lg:px-8 py-4 text-xs text-muted-foreground flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <span className="font-semibold text-foreground">{clinic.name}</span> — {clinic.doctorName} · {clinic.tagline}
            </div>
            <div className="space-y-0.5 md:text-right">
              <div>{clinic.address}</div>
              <div>Phone: {clinic.phone}</div>
            </div>
          </div>
          <div className="px-4 lg:px-8 pb-3 text-[11px] text-muted-foreground/80 text-center md:text-left">
            {clinic.copyrightText}
          </div>
        </footer>
      </div>
    </SidebarContext.Provider>
  );
};

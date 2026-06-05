import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";

import DietSection from "./pages/DietSection";
import Bills from "./pages/Bills";
import Templates from "./pages/Templates";
import Employees from "./pages/Employees";
import Recipes from "./pages/Recipes";
import MealRecipesImport from "./pages/MealRecipesImport";
import Appointments from "./pages/Appointments";
import BodyMeasurements from "./pages/BodyMeasurements";
import BloodReports from "./pages/BloodReports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,   // treat data as fresh for 2 min — no refetch on every navigation
      gcTime: 10 * 60 * 1000,     // keep unused data in cache for 10 min
      refetchOnWindowFocus: false, // don't blast all queries when user clicks back on the tab
      retry: 1,                   // only retry failed requests once instead of 3 times
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
            <Route path="/body-measurements" element={<ProtectedRoute><BodyMeasurements /></ProtectedRoute>} />
            <Route path="/blood-reports" element={<ProtectedRoute><BloodReports /></ProtectedRoute>} />
            <Route path="/appointments" element={<ProtectedRoute><Appointments /></ProtectedRoute>} />
            
            <Route path="/diet-section" element={<ProtectedRoute><DietSection /></ProtectedRoute>} />
            <Route path="/bills" element={<ProtectedRoute><Bills /></ProtectedRoute>} />
            <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
            <Route path="/recipes" element={<ProtectedRoute><Recipes /></ProtectedRoute>} />
            <Route path="/meal-recipes-import" element={<ProtectedRoute><MealRecipesImport /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

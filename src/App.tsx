import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { useMissionNotifications } from "@/hooks/useNotifications";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import StepUpOAuthReturn from "@/components/security/StepUpOAuthReturn";
import { SpeedInsights } from "@vercel/speed-insights/react";

const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NewMission = lazy(() => import("./pages/NewMission"));
const MissionDetail = lazy(() => import("./pages/MissionDetail"));
const Ledger = lazy(() => import("./pages/Ledger"));
const ConnectedAccounts = lazy(() => import("./pages/ConnectedAccounts"));
const PolicyEngine = lazy(() => import("./pages/PolicyEngine"));
const MobileApproval = lazy(() => import("./pages/MobileApproval"));
const Install = lazy(() => import("./pages/Install"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">Loading view...</div>
    </div>
  );
}

function NotificationListener() {
  useMissionNotifications();
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
        <StepUpOAuthReturn />
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <NotificationListener />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/approve" element={<MobileApproval />} />
                <Route path="/install" element={<Install />} />

                <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
                <Route path="/mission/new" element={<ProtectedPage><NewMission /></ProtectedPage>} />
                <Route path="/mission/:id" element={<ProtectedPage><MissionDetail /></ProtectedPage>} />
                <Route path="/ledger" element={<ProtectedPage><Ledger /></ProtectedPage>} />
                <Route path="/accounts" element={<ProtectedPage><ConnectedAccounts /></ProtectedPage>} />
                <Route path="/policy" element={<ProtectedPage><PolicyEngine /></ProtectedPage>} />
                <Route path="/settings" element={<ProtectedPage><Settings /></ProtectedPage>} />

                <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </TooltipProvider>
      </AuthProvider>
    </BrowserRouter>
    <SpeedInsights />
  </QueryClientProvider>
);

export default App;

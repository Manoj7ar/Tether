import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Rocket } from "lucide-react";
import TetherLogo from "@/components/layout/TetherLogo";
import { useAuth } from "@/hooks/useAuth";

export default function MobileApproval() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/auth", { replace: true, state: { returnTo: "/approve" } });
    }
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6">
        <TetherLogo size="lg" />
      </div>

      <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-6">
        <Rocket className="h-8 w-8 text-primary" />
      </div>

      <h1 className="font-display text-2xl font-bold text-foreground mb-3">
        Missions auto-launch now
      </h1>
      <p className="text-sm text-muted-foreground max-w-xs mb-8">
        Missions are confirmed with a swipe when you create them. No separate approval step is needed anymore.
      </p>

      <button
        onClick={() => navigate("/dashboard")}
        className="btn-glass-primary px-8 py-3 text-sm"
      >
        Go to Dashboard
      </button>
    </div>
  );
}

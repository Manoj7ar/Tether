import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  // #region agent log
  useEffect(() => {
    fetch("http://127.0.0.1:7331/ingest/73856759-8783-4062-ac2d-fb1e9443f226", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "fa3011" },
      body: JSON.stringify({
        sessionId: "fa3011",
        location: "ProtectedRoute.tsx",
        message: "protected_route_state",
        data: { loading, isAuthenticated, path: location.pathname },
        timestamp: Date.now(),
        hypothesisId: "H1",
      }),
    }).catch(() => {});
  }, [loading, isAuthenticated, location.pathname]);
  // #endregion

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ returnTo: `${location.pathname}${location.search}${location.hash}` }} />;
  }

  return <>{children}</>;
}

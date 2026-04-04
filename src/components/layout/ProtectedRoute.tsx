import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/** Auth0 can briefly report `isAuthenticated: false` during hydration / token work; avoid redirect loops. */
const UNAUTH_REDIRECT_DELAY_MS = 600;

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const [allowLoginRedirect, setAllowLoginRedirect] = useState(false);

  useEffect(() => {
    if (loading || isAuthenticated) {
      setAllowLoginRedirect(false);
      return;
    }
    const t = window.setTimeout(() => setAllowLoginRedirect(true), UNAUTH_REDIRECT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (!allowLoginRedirect) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-muted-foreground text-sm">Checking session…</div>
        </div>
      );
    }
    return <Navigate to="/auth" replace state={{ returnTo: `${location.pathname}${location.search}${location.hash}` }} />;
  }

  return <>{children}</>;
}

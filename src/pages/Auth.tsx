import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import authLoginBg from "@/assets/auth-nature.jpg";
import authSignupBg from "@/assets/auth-signup-nature.jpg";
import TetherLogo from "@/components/TetherLogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { getErrorMessage } from "@/lib/error-utils";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, login, resetPassword, user } = useAuth();
  const location = useLocation();
  const state = location.state as { returnTo?: string } | null;

  const handleAuth = async (screenHint?: "signup") => {
    setLoading(true);

    try {
      await login({
        returnTo: state?.returnTo || "/dashboard",
        ...(screenHint ? { screenHint } : {}),
      });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Authentication failed"));
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      toast.error("Enter your email first");
      return;
    }

    setLoading(true);

    try {
      await resetPassword(email.trim());
      toast.success("Password reset email sent. Check your inbox.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Password reset failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src={isLogin ? authLoginBg : authSignupBg}
          alt="Lush tropical foliage"
          className="absolute inset-0 w-full h-full object-cover transition-all duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-10 text-white">
          <TetherLogo size="lg" className="mb-4 [&_span]:text-white" />
          <p className="text-lg font-display leading-relaxed max-w-md opacity-90">
            "The agent treats your credentials as inaccessible. That is by design."
          </p>
          <p className="text-sm mt-3 opacity-60">
            Mission-scoped authorization for AI agents
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex justify-center">
            <TetherLogo size="lg" />
          </div>

          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            {isLogin ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-muted-foreground text-sm mb-8">
            {isAuthenticated && user?.email
              ? `Signed in as ${user.email}`
              : isLogin
                ? "Sign in with Auth0 Universal Login to manage your agent's access."
                : "Create your account with Auth0 Universal Login."}
          </p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className="mt-1.5"
              />
            </div>

            <button
              type="button"
              onClick={() => handleAuth(isLogin ? undefined : "signup")}
              disabled={loading}
              className="btn-glass-primary w-full py-3 text-sm disabled:opacity-50"
            >
              {loading ? "Redirecting..." : isLogin ? "Continue with Auth0" : "Create Account with Auth0"}
            </button>

            {isLogin && (
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full text-xs text-primary hover:underline disabled:opacity-50"
              >
                Send password reset email
              </button>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              onClick={() => setIsLogin((current) => !current)}
              className="text-primary font-medium hover:underline"
            >
              {isLogin ? "Sign up" : "Sign in"}
            </button>
          </p>

          <div className="mt-8 text-center">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
              ← Back to homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

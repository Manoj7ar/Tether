import { Link } from "react-router-dom";
import TetherLogo from "@/components/TetherLogo";

export default function ResetPassword() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <TetherLogo size="lg" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground mb-2">Reset your password in Auth0</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Password reset is handled by Auth0 Universal Login. Use the reset link from your email, then return here to sign in again.
        </p>
        <Link to="/auth" className="btn-glass-primary inline-flex px-5 py-3 text-sm">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

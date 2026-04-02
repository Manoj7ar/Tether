import { Link } from "react-router-dom";
import { CheckCircle2, AlertCircle, LinkIcon } from "lucide-react";
import type { MissionPermission, ConnectedAccount } from "@/hooks/useMissions";

interface RequiredAccountsProps {
  permissions: MissionPermission[];
  connectedAccounts: ConnectedAccount[];
}

export default function RequiredAccounts({ permissions, connectedAccounts }: RequiredAccountsProps) {
  // Extract unique providers from permissions
  const requiredProviders = [...new Set(permissions.map((p) => p.provider))];

  if (requiredProviders.length === 0) return null;

  const connectedMap = new Map(
    connectedAccounts.map((a) => [a.provider, a])
  );

  const allConnected = requiredProviders.every((p) => connectedMap.get(p)?.is_active);
  const missingCount = requiredProviders.filter((p) => !connectedMap.get(p)?.is_active).length;

  return (
    <div className={`rounded-xl border px-5 py-4 space-y-3 ${
      allConnected
        ? "bg-primary/5 border-primary/20"
        : "bg-destructive/5 border-destructive/20"
    }`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          Required Accounts
        </p>
        {!allConnected && (
          <span className="text-xs text-destructive font-medium">
            {missingCount} missing
          </span>
        )}
      </div>

      <div className="space-y-2">
        {requiredProviders.map((provider) => {
          const account = connectedMap.get(provider);
          const isConnected = account?.is_active;

          return (
            <div key={provider} className="flex items-center gap-3 text-sm">
              {isConnected ? (
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              )}
              <span className="font-medium text-foreground">{provider}</span>
              {isConnected ? (
                <span className="text-xs text-muted-foreground ml-auto">
                  {account?.provider_username || "Connected"}
                </span>
              ) : (
                <Link
                  to="/accounts"
                  className="text-xs text-primary hover:underline ml-auto inline-flex items-center gap-1"
                >
                  <LinkIcon className="h-3 w-3" />
                  Connect
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {!allConnected && (
        <p className="text-xs text-muted-foreground">
          Connect missing accounts before approving this mission.
        </p>
      )}
    </div>
  );
}

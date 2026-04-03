import { Shield, RefreshCw, Unlink, Link2 } from "lucide-react";
import { useConnectedAccounts } from "@/hooks/useMissions";
import { useReauthProvider, useDisconnectAccount } from "@/hooks/useTokenVault";
import ConnectProviderButtons, {
  providerIcons,
} from "@/components/accounts/ConnectProviderButtons";
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function ConnectedAccounts() {
  const { data: accounts = [], isLoading } = useConnectedAccounts();
  const reauthProvider = useReauthProvider();
  const disconnectAccount = useDisconnectAccount();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  // Show success toast when redirected back after connecting
  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected) {
      toast({ title: "Account connected", description: `${connected} has been linked successfully.` });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Connected Accounts</h1>

      {/* Security Banner */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 px-5 py-4 flex items-start gap-3">
        <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-foreground leading-relaxed">
          Tether uses an <strong>Auth0-backed connection flow</strong> and keeps execution tokens encrypted on the server. The browser and the agent never receive raw OAuth credentials, and audit logs store only redacted action metadata.
        </p>
      </div>

      <ConnectProviderButtons />

      {/* Account Cards */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="card-tether p-12 text-center text-sm text-muted-foreground">Loading accounts...</div>
        ) : accounts.length === 0 ? (
          <div className="card-tether p-12 text-center">
            <div className="mb-4"><Link2 className="h-10 w-10 text-muted-foreground mx-auto" /></div>
            <h2 className="font-display text-xl font-semibold text-foreground mb-2">No accounts connected</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Connect your accounts above to allow Tether to execute mission actions on your behalf.
            </p>
          </div>
        ) : (
          accounts.map((a, i) => (
            <div
              key={a.id}
              className="card-tether p-6 animate-card-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span>{providerIcons[a.provider] || <Link2 className="h-5 w-5 text-foreground" />}</span>
                  <span className="font-medium text-foreground">{a.provider}</span>
                </div>
                <span className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 rounded-full ${a.is_active ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  <span className={a.is_active ? "text-primary font-medium" : "text-muted-foreground"}>
                    {a.is_active ? "Connected" : "Inactive"}
                  </span>
                </span>
              </div>

              {a.provider_username && (
                <p className="text-sm text-muted-foreground mb-3">{a.provider_username}</p>
              )}

              {a.scopes && a.scopes.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1.5">Granted scopes:</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {a.scopes.map((s) => (
                      <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-0.5 mb-4">
                <p>Connection broker: Auth0-backed token exchange</p>
                <p>Connected: {new Date(a.connected_at).toLocaleDateString()}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => reauthProvider.mutate(a.provider)}
                  disabled={reauthProvider.isPending}
                  className="btn-glass-ghost px-4 py-2 text-sm inline-flex items-center gap-2"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${reauthProvider.isPending ? "animate-spin" : ""}`} />
                  Re-authenticate
                </button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="btn-glass-destructive px-4 py-2 text-sm inline-flex items-center gap-2">
                      <Unlink className="h-3.5 w-3.5" />
                      Disconnect
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect {a.provider}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will revoke Tether's access to {a.provider}. Active missions using this provider will be affected.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          disconnectAccount.mutate(a.id, {
                            onSuccess: () => toast({ title: "Disconnected", description: `${a.provider} has been removed.` }),
                            onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
                          });
                        }}
                      >
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

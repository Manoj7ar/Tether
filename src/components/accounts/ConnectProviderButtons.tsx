import { Github, Mail, Calendar, MessageSquare, Link2, Loader2, Plus } from "lucide-react";
import { useConnectedAccounts } from "@/hooks/useMissions";
import { useConnectProvider } from "@/hooks/useTokenVault";

export const providerIcons: Record<string, React.ReactNode> = {
  GitHub: <Github className="h-4 w-4 text-foreground" />,
  Gmail: <Mail className="h-4 w-4 text-foreground" />,
  "Google Calendar": <Calendar className="h-4 w-4 text-foreground" />,
  Slack: <MessageSquare className="h-4 w-4 text-foreground" />,
};

export const AVAILABLE_CONNECT_PROVIDERS = ["GitHub", "Gmail", "Google Calendar", "Slack"] as const;

type ConnectProviderButtonsProps = {
  /** Smaller padding for compact layouts (e.g. onboarding). */
  compact?: boolean;
  /** App path to open after OAuth (must start with `/`). Defaults to `/accounts?connected=…`. */
  connectReturnPath?: string;
};

export default function ConnectProviderButtons({
  compact,
  connectReturnPath,
}: ConnectProviderButtonsProps) {
  const { data: accounts = [] } = useConnectedAccounts();
  const connectProvider = useConnectProvider();

  const connectedProviders = new Set(accounts.map((a) => a.provider));
  const unconnectedProviders = AVAILABLE_CONNECT_PROVIDERS.filter((p) => !connectedProviders.has(p));

  if (unconnectedProviders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        All supported providers are connected. You can manage them anytime under Connected Accounts.
      </p>
    );
  }

  const btnClass = compact
    ? "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-accent transition-all duration-200 disabled:opacity-50"
    : "inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-accent hover:scale-[1.02] hover:shadow-sm active:scale-[0.98] transition-all duration-200 disabled:opacity-50";

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Connect a provider</p>
      <div className="flex gap-2 flex-wrap">
        {unconnectedProviders.map((provider) => (
          <button
            key={provider}
            type="button"
            onClick={() =>
              connectProvider.mutate(
                connectReturnPath
                  ? { provider, returnPath: connectReturnPath }
                  : provider,
              )
            }
            disabled={connectProvider.isPending}
            className={btnClass}
          >
            <span>{providerIcons[provider] || <Link2 className="h-4 w-4 text-foreground" />}</span>
            <span>{provider}</span>
            {connectProvider.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

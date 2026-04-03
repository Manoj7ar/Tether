import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import TetherLogo from "@/components/layout/TetherLogo";
import ConnectProviderButtons from "@/components/accounts/ConnectProviderButtons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/useUserSettings";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/error-utils";
import { cn } from "@/lib/utils";
import { useConnectedAccounts } from "@/hooks/useMissions";

const STEPS = 3;

export default function Onboarding() {
  const navigate = useNavigate();
  const { data: settings, isLoading: settingsLoading, isSuccess } = useUserSettings();
  const updateSettings = useUpdateUserSettings();
  const { data: accounts = [] } = useConnectedAccounts();

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [ambientEnabled, setAmbientEnabled] = useState(false);

  useEffect(() => {
    if (isSuccess && settings?.onboarding_completed) {
      navigate("/dashboard", { replace: true });
    }
  }, [isSuccess, settings?.onboarding_completed, navigate]);

  const completeOnboarding = async () => {
    const name = displayName.trim();
    if (!name) {
      toast({
        title: "Name required",
        description: "Go back to step 1 and enter how we should address you.",
        variant: "destructive",
      });
      return;
    }
    try {
      await updateSettings.mutateAsync({
        display_name: name,
        mcp_enabled: mcpEnabled,
        ambient_enabled: ambientEnabled,
        onboarding_completed: true,
      });
      toast({ title: "You're all set", description: "Welcome to Tether." });
      navigate("/dashboard", { replace: true });
    } catch (error: unknown) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg space-y-8 animate-card-in">
        {settingsLoading && (
          <p className="text-center text-xs text-muted-foreground">Checking your account…</p>
        )}
        <div className="flex flex-col items-center gap-3 text-center">
          <TetherLogo size="lg" />
          <h1 className="font-display text-2xl font-bold text-foreground">Set up Tether</h1>
          <p className="text-sm text-muted-foreground max-w-sm">
            A quick tour so we know what to call you and which capabilities to enable.
          </p>
        </div>

        <div className="flex justify-center gap-2" aria-hidden>
          {Array.from({ length: STEPS }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                i === step ? "bg-primary" : "bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground font-medium">
          Step {step + 1} of {STEPS}
        </p>

        <div className="card-tether p-6 sm:p-8 space-y-6">
          {step === 0 && (
            <>
              <div>
                <Label htmlFor="onboarding-name" className="text-sm">
                  What should we call you?
                </Label>
                <Input
                  id="onboarding-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="mt-2"
                  autoComplete="name"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  This appears in the sidebar. You can change it later in Settings.
                </p>
              </div>
              <button
                type="button"
                disabled={!displayName.trim()}
                onClick={() => setStep(1)}
                className="btn-glass-primary w-full py-3 text-sm disabled:opacity-50"
              >
                Continue
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <p className="font-semibold text-foreground text-sm">MCP Server Mode</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Expose Tether as an MCP server so external agents can call tools through your policies.
                    </p>
                  </div>
                  <Switch checked={mcpEnabled} onCheckedChange={setMcpEnabled} />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary shrink-0" />
                      Ambient Agent Mode
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Always-on agent with a standing budget for pre-approved low-risk actions.
                    </p>
                  </div>
                  <Switch checked={ambientEnabled} onCheckedChange={setAmbientEnabled} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                You can change these anytime in Settings after you finish this setup.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="btn-glass-ghost flex-1 py-3 text-sm"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-glass-primary flex-1 py-3 text-sm"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
                <p className="text-sm text-foreground leading-relaxed">
                  Link GitHub, Gmail, Calendar, or Slack so missions can run with your authorization. Tokens stay
                  encrypted on the server.
                </p>
              </div>
              <ConnectProviderButtons compact connectReturnPath="/onboarding" />
              {accounts.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {accounts.length} account{accounts.length === 1 ? "" : "s"} connected. You can add more later under
                  Connected Accounts.
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn-glass-ghost sm:flex-1 py-3 text-sm order-2 sm:order-1"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={completeOnboarding}
                  disabled={updateSettings.isPending}
                  className="btn-glass-ghost sm:flex-1 py-3 text-sm order-3"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={completeOnboarding}
                  disabled={updateSettings.isPending}
                  className="btn-glass-primary sm:flex-1 py-3 text-sm order-1 sm:order-3 disabled:opacity-50"
                >
                  {updateSettings.isPending ? "Saving…" : "Finish"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

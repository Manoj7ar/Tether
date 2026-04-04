import { useEffect, useState } from "react";
import { Bell, Download, Smartphone, Check, Shield, Wifi } from "lucide-react";
import { useNotificationPermission, usePushSubscription } from "@/hooks/useNotifications";
import TetherLogo from "@/components/layout/TetherLogo";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function Install() {
  const { supported, permission, requestPermission } = useNotificationPermission();
  const { subscribed: pushSubscribed } = usePushSubscription(permission);
  const [notifStatus, setNotifStatus] = useState(permission);

  useEffect(() => {
    setNotifStatus(permission);
  }, [permission]);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredPrompt(installEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
    }
  };

  const handleEnableNotifications = async () => {
    const result = await requestPermission();
    setNotifStatus(result);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-md w-full space-y-8 animate-card-in">
        <div className="text-center">
          <div className="mb-6">
            <TetherLogo size="lg" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Install Tether</h1>
          <p className="text-sm text-muted-foreground">
            Get instant approval notifications on your phone. Install Tether as an app and never miss a mission.
          </p>
        </div>

        {/* Step 1: Install */}
        <div className="card-tether p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground mb-1">Step 1: Install the App</h3>
              <p className="text-xs text-muted-foreground mb-3">
                {deferredPrompt
                  ? "Tap below to install Tether to your home screen."
                  : "On your phone, tap your browser's menu → \"Add to Home Screen\" to install Tether."}
              </p>
              {deferredPrompt ? (
                <button onClick={handleInstall} className="btn-glass-primary px-5 py-2.5 text-sm flex items-center gap-2">
                  <Download className="h-4 w-4" /> Install Tether
                </button>
              ) : installed ? (
                <span className="text-sm text-primary flex items-center gap-2">
                  <Check className="h-4 w-4" /> Installed!
                </span>
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  Open this page on your phone to install
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Notifications */}
        <div className="card-tether p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground mb-1">Step 2: Enable Notifications</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Get push notifications when your agent requests approval.
              </p>
              {!supported ? (
                <span className="text-xs text-muted-foreground italic">
                  Notifications not supported in this browser
                </span>
              ) : notifStatus === "granted" ? (
                <span className="text-sm text-primary flex items-center gap-2">
                  <Check className="h-4 w-4" /> Notifications enabled
                </span>
              ) : notifStatus === "denied" ? (
                <span className="text-xs text-destructive">
                  Notifications blocked. Please enable them in your browser settings.
                </span>
              ) : (
                <button onClick={handleEnableNotifications} className="btn-glass-primary px-5 py-2.5 text-sm flex items-center gap-2">
                  <Bell className="h-4 w-4" /> Enable Notifications
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Push status */}
        <div className="card-tether p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Wifi className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground mb-1">Step 3: Push Subscription</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Receive notifications even when the app is closed.
              </p>
              {pushSubscribed ? (
                <span className="text-sm text-primary flex items-center gap-2">
                  <Check className="h-4 w-4" /> Push active on this device
                </span>
              ) : notifStatus === "granted" ? (
                <span className="text-xs text-muted-foreground italic">
                  Subscribing to push...
                </span>
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  Enable notifications first (Step 2)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="rounded-xl bg-primary/5 border border-primary/20 px-5 py-4 flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Tether will only notify you when a mission needs approval. Your data stays on your device.
            Works offline once installed.
          </p>
        </div>
      </div>
    </div>
  );
}

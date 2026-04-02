import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getAppConfig } from "@/lib/env";

type VaultConnectInput = string | { provider: string; returnPath?: string };

function buildTokenVaultUrl(action: string) {
  const { supabaseProjectId, supabaseUrl } = getAppConfig();
  const base = supabaseProjectId
    ? `https://${supabaseProjectId}.supabase.co/functions/v1/auth0-token-vault`
    : `${supabaseUrl}/functions/v1/auth0-token-vault`;

  const url = new URL(base);
  url.searchParams.set("action", action);
  return url.toString();
}

function normalizeVaultInput(input: VaultConnectInput): { provider: string; returnPath?: string } {
  return typeof input === "string" ? { provider: input } : input;
}

export function useConnectProvider() {
  const { getAccessToken } = useAuth();

  return useMutation({
    mutationFn: async (input: VaultConnectInput) => {
      const { provider, returnPath } = normalizeVaultInput(input);
      const token = await getAccessToken();
      const res = await fetch(buildTokenVaultUrl("connect"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          apikey: getAppConfig().supabasePublishableKey,
        },
        body: JSON.stringify({ provider, returnPath }),
      });

      const data = await res.json().catch(() => ({ error: "Request failed" }));
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      if (data?.authorizeUrl) {
        window.location.href = data.authorizeUrl;
      }

      return data;
    },
  });
}

export function useReauthProvider() {
  const { getAccessToken } = useAuth();

  return useMutation({
    mutationFn: async (input: VaultConnectInput) => {
      const { provider, returnPath } = normalizeVaultInput(input);
      const token = await getAccessToken();
      const res = await fetch(buildTokenVaultUrl("reauth"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          apikey: getAppConfig().supabasePublishableKey,
        },
        body: JSON.stringify({ provider, returnPath }),
      });

      const data = await res.json().catch(() => ({ error: "Request failed" }));
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      if (data?.authorizeUrl) {
        window.location.href = data.authorizeUrl;
      }

      return data;
    },
  });
}

export function useDisconnectAccount() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const token = await getAccessToken();
      const res = await fetch(buildTokenVaultUrl("disconnect"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          apikey: getAppConfig().supabasePublishableKey,
        },
        body: JSON.stringify({ accountId }),
      });

      const data = await res.json().catch(() => ({ error: "Request failed" }));
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connected_accounts"] });
    },
  });
}

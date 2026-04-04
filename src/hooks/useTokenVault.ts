import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { callEdgeApi } from "@/lib/edge-call";
import { getSupabaseFunctionsBaseUrl } from "@/lib/env";
import { toast } from "sonner";

type VaultConnectInput = string | { provider: string; returnPath?: string };

function buildTokenVaultUrl(action: string) {
  const url = new URL(`${getSupabaseFunctionsBaseUrl()}/auth0-token-vault`);
  url.searchParams.set("action", action);
  return url.toString();
}

function normalizeVaultInput(input: VaultConnectInput): { provider: string; returnPath?: string } {
  return typeof input === "string" ? { provider: input } : input;
}

export function useConnectProvider() {
  const { getAccessToken } = useAuth();
  const demo = useDemoMode();

  return useMutation({
    mutationFn: async (input: VaultConnectInput) => {
      if (demo) {
        const { provider } = normalizeVaultInput(input);
        toast.success(`Demo: ${provider} connected`);
        return { demo: true };
      }
      const { provider, returnPath } = normalizeVaultInput(input);
      const data = await callEdgeApi(getAccessToken, {
        url: buildTokenVaultUrl("connect"),
        body: { provider, returnPath },
        includeApiKey: true,
      });

      if ((data as { authorizeUrl?: string })?.authorizeUrl) {
        window.location.href = (data as { authorizeUrl: string }).authorizeUrl;
      }

      return data;
    },
  });
}

export function useReauthProvider() {
  const { getAccessToken } = useAuth();
  const demo = useDemoMode();

  return useMutation({
    mutationFn: async (input: VaultConnectInput) => {
      if (demo) {
        const { provider } = normalizeVaultInput(input);
        toast.success(`Demo: ${provider} re-authenticated`);
        return { demo: true };
      }
      const { provider, returnPath } = normalizeVaultInput(input);
      const data = await callEdgeApi(getAccessToken, {
        url: buildTokenVaultUrl("reauth"),
        body: { provider, returnPath },
        includeApiKey: true,
      });

      if ((data as { authorizeUrl?: string })?.authorizeUrl) {
        window.location.href = (data as { authorizeUrl: string }).authorizeUrl;
      }

      return data;
    },
  });
}

export function useDisconnectAccount() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();
  const demo = useDemoMode();

  return useMutation({
    mutationFn: async (accountId: string) => {
      if (demo) {
        toast.success("Demo: Account disconnected");
        return { demo: true };
      }
      const data = await callEdgeApi(getAccessToken, {
        url: buildTokenVaultUrl("disconnect"),
        body: { accountId },
        includeApiKey: true,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connected_accounts"] });
    },
  });
}

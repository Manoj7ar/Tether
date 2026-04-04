import { useUserSettings } from "@/hooks/useUserSettings";

export function useDemoMode(): boolean {
  const { data: settings } = useUserSettings();
  return settings?.demo_mode ?? false;
}

import type { UserScopedSupabase } from "./supabase-user.server";
import { DEFAULT_ASSISTANT_SETTINGS, type AssistantSettings } from "./assistant-settings.shared";

export async function loadAssistantSettings(supabase: UserScopedSupabase, userId: string): Promise<AssistantSettings> {
  const { data } = await supabase.from("assistant_settings").select("*").eq("user_id", userId).maybeSingle();
  return data
    ? {
        ...DEFAULT_ASSISTANT_SETTINGS,
        ...(data as Partial<AssistantSettings>),
        user_id: userId,
      }
    : {
        user_id: userId,
        ...DEFAULT_ASSISTANT_SETTINGS,
      };
}

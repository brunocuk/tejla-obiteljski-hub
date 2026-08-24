import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Per-user notification preferences.
 *
 * "Tejline poruke" are strictly opt-in: no row (or false) means OFF. This
 * switch never affects the reminders a user created themselves.
 */
export const TEJLA_MESSAGES_DEFAULT = false;

export function useTejlaMessagesEnabled() {
  return useQuery({
    queryKey: ["notification-prefs"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return TEJLA_MESSAGES_DEFAULT;
      const { data } = await supabase
        .from("user_notification_prefs")
        .select("tejla_messages_enabled")
        .eq("user_id", uid)
        .maybeSingle();
      return data?.tejla_messages_enabled ?? TEJLA_MESSAGES_DEFAULT;
    },
  });
}

export function useSetTejlaMessages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Nisi prijavljen.");
      const { error } = await supabase
        .from("user_notification_prefs")
        .upsert({ user_id: uid, tejla_messages_enabled: enabled }, { onConflict: "user_id" });
      if (error) throw error;
      return enabled;
    },
    onSuccess: (enabled) => qc.setQueryData(["notification-prefs"], enabled),
  });
}

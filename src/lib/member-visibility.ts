import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type VisibilityMode = "own" | "own_shared" | "all" | "custom";

export type VisibilityRow = {
  id: string;
  family_id: string;
  family_member_id: string;
  mode: VisibilityMode;
  see_own: boolean;
  see_shared: boolean;
  allowed_member_ids: string[];
};

export const VISIBILITY_LABELS: Record<VisibilityMode, string> = {
  own: "Samo svoje obveze",
  own_shared: "Svoje + zajedničke",
  all: "Sve u prostoru",
  custom: "Prilagođeno",
};

export function useMemberVisibility(familyId: string | null | undefined) {
  return useQuery({
    queryKey: ["member-visibility", familyId],
    enabled: Boolean(familyId),
    queryFn: async (): Promise<Record<string, VisibilityRow>> => {
      const { data, error } = await supabase
        .from("member_visibility")
        .select("id, family_id, family_member_id, mode, see_own, see_shared, allowed_member_ids")
        .eq("family_id", familyId!);
      if (error) throw error;
      const map: Record<string, VisibilityRow> = {};
      for (const row of data ?? []) map[row.family_member_id] = row as VisibilityRow;
      return map;
    },
  });
}

/** Creates or updates the visibility rule for one member. Adults only (enforced by RLS). */
export async function saveMemberVisibility(
  familyId: string,
  familyMemberId: string,
  patch: {
    mode: VisibilityMode;
    see_own?: boolean;
    see_shared?: boolean;
    allowed_member_ids?: string[];
  },
) {
  const { error } = await supabase.from("member_visibility").upsert(
    {
      family_id: familyId,
      family_member_id: familyMemberId,
      mode: patch.mode,
      see_own: patch.see_own ?? true,
      see_shared: patch.see_shared ?? true,
      allowed_member_ids: patch.allowed_member_ids ?? [],
    },
    { onConflict: "family_member_id" },
  );
  if (error) throw error;
}

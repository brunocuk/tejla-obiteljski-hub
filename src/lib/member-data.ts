import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MemberDataCounts = { tasks: number; events: number; reminders: number };
export type PurgeScope = "tasks" | "events" | "reminders" | "all";
export type PurgeResult = {
  deleted_events: number;
  unlinked_events: number;
  deleted_reminders: number;
};

export async function fetchMemberDataCounts(memberId: string): Promise<MemberDataCounts> {
  const { data, error } = await supabase.rpc("member_data_counts", { _member_id: memberId });
  if (error) throw error;
  return (data ?? { tasks: 0, events: 0, reminders: 0 }) as unknown as MemberDataCounts;
}

export function useMemberDataCounts(memberId: string | null | undefined) {
  return useQuery({
    queryKey: ["member-data-counts", memberId],
    enabled: Boolean(memberId),
    queryFn: () => fetchMemberDataCounts(memberId!),
  });
}

export async function purgeMemberData(memberId: string, scope: PurgeScope): Promise<PurgeResult> {
  const { data, error } = await supabase.rpc("purge_member_data", {
    _member_id: memberId,
    _scope: scope,
  });
  if (error) throw error;
  return (data ?? {
    deleted_events: 0,
    unlinked_events: 0,
    deleted_reminders: 0,
  }) as unknown as PurgeResult;
}

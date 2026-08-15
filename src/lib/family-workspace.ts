import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FamilyMemberRow = {
  id: string;
  family_id: string;
  name: string;
  member_type: "parent" | "child";
  linked_user_id: string | null;
  created_at: string;
};

export async function fetchMyFamilyId(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("family_users")
    .select("family_id")
    .eq("user_id", uid)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.family_id ?? null;
}

export function useMyFamilyId() {
  return useQuery({ queryKey: ["my-family-id"], queryFn: fetchMyFamilyId });
}

export function useMyUserId() {
  return useQuery({
    queryKey: ["my-user-id"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user?.id ?? null;
    },
  });
}

export function useMyFamily(familyId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-family", familyId],
    enabled: Boolean(familyId),
    queryFn: async (): Promise<{ id: string; name: string } | null> => {
      const { data, error } = await supabase
        .from("families")
        .select("id, name")
        .eq("id", familyId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/** Updates the signed-in user's own display name (profile + linked family member). */
export async function updateMyDisplayName(familyId: string, name: string) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Nisi prijavljen.");

  const { error: profileError } = await supabase.from("profiles").update({ name }).eq("id", uid);
  if (profileError) throw profileError;

  const { error: memberError } = await supabase
    .from("family_members")
    .update({ name })
    .eq("family_id", familyId)
    .eq("linked_user_id", uid);
  if (memberError) throw memberError;
}

export async function fetchMyFamilyRole(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("family_users")
    .select("role")
    .eq("user_id", uid)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.role ?? null;
}

export function useMyFamilyRole() {
  return useQuery({ queryKey: ["my-family-role"], queryFn: fetchMyFamilyRole });
}

/** Joins the family only when a pending invitation exists for the signed-in e-mail. */
export async function acceptPendingInvitation(): Promise<string | null> {
  const { data, error } = await supabase.rpc("accept_family_invitation");
  if (error) return null;
  return (data as string | null) ?? null;
}

export type PendingInvitation = {
  id: string;
  family_id: string;
  family_name: string;
  role: "parent" | "child" | string;
};

/** Read-only peek at a pending invitation. Never joins the family by itself. */
export async function fetchPendingInvitation(): Promise<PendingInvitation | null> {
  const rpc = supabase.rpc as unknown as (
    name: string,
  ) => Promise<{ data: unknown; error: unknown }>;
  document.title = "DBG-CALLED";
  const { data, error } = await rpc("pending_family_invitation");
  document.title = "DBG:" + JSON.stringify(data) + "|" + JSON.stringify(error);
  if (error || !data) return null;
  return data as PendingInvitation;
}

export function usePendingInvitation(enabled: boolean) {
  return useQuery({
    queryKey: ["pending-invitation"],
    enabled,
    retry: false,
    queryFn: fetchPendingInvitation,
  });
}

export function useFamilyMembers(familyId: string | null | undefined) {
  return useQuery({
    queryKey: ["family-members", familyId],
    enabled: Boolean(familyId),
    queryFn: async (): Promise<FamilyMemberRow[]> => {
      const { data, error } = await supabase
        .from("family_members")
        .select("*")
        .eq("family_id", familyId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FamilyMemberRow[];
    },
  });
}

export async function createFamily(familyName: string, myName: string) {
  // Atomic, RLS-safe creation of family + owner membership + parent member.
  const { data, error } = await supabase.rpc("create_family", {
    _family_name: familyName,
    _my_name: myName,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function addFamilyMember(
  familyId: string,
  name: string,
  memberType: "parent" | "child",
) {
  const { error } = await supabase
    .from("family_members")
    .insert({ family_id: familyId, name, member_type: memberType });
  if (error) throw error;
}

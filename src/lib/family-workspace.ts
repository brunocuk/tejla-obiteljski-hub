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
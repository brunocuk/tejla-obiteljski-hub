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
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Niste prijavljeni.");

  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({ name: familyName, created_by: uid })
    .select("id")
    .single();
  if (familyError) throw familyError;

  const { error: userError } = await supabase
    .from("family_users")
    .insert({ family_id: family.id, user_id: uid, role: "owner" });
  if (userError) throw userError;

  const { error: memberError } = await supabase
    .from("family_members")
    .insert({ family_id: family.id, name: myName, member_type: "parent", linked_user_id: uid });
  if (memberError) throw memberError;

  return family.id;
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
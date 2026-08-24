import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FamilyMemberRow = {
  id: string;
  family_id: string;
  name: string;
  member_type: "parent" | "child";
  linked_user_id: string | null;
  created_at: string;
  /** Set when the person deleted their account: the row is a read-only history trace. */
  archived_at?: string | null;
};

/** A GDPR tombstone kept only so past events keep their participants. */
export function isArchivedMember(
  member: Pick<FamilyMemberRow, "archived_at"> | null | undefined,
): boolean {
  return Boolean(member?.archived_at);
}

/** Members that may still be assigned new obligations. */
export function assignableMembers<T extends Pick<FamilyMemberRow, "archived_at">>(rows: T[]): T[] {
  return rows.filter((m) => !isArchivedMember(m));
}

/**
 * Choices for an existing event: archived members stay listed only where they
 * already are participants, so saved history keeps its people.
 */
export function eventAssigneeChoices<T extends Pick<FamilyMemberRow, "id" | "archived_at">>(
  rows: T[],
  currentMemberIds: string[],
): T[] {
  return rows.filter((m) => !isArchivedMember(m) || currentMemberIds.includes(m.id));
}

type MemberPolicyInput = Pick<FamilyMemberRow, "linked_user_id" | "archived_at">;

/** UI policy: who may be invited to their own account. */
export function canInviteMemberToAccount(member: MemberPolicyInput, isOwner: boolean): boolean {
  return isOwner && !isArchivedMember(member) && !member.linked_user_id;
}

/** UI policy: whose display name may be edited (only your own, never a tombstone). */
export function canEditMemberName(
  member: MemberPolicyInput,
  myUserId: string | null | undefined,
): boolean {
  return !isArchivedMember(member) && Boolean(myUserId) && member.linked_user_id === myUserId;
}

/** UI policy: who may be removed from the family. */
export function canRemoveMemberFromFamily(
  member: MemberPolicyInput,
  isAdult: boolean,
  myUserId: string | null | undefined,
): boolean {
  return isAdult && !isArchivedMember(member) && member.linked_user_id !== myUserId;
}

/** UI policy: who may receive new (future) obligations. */
export function canAssignNewObligation(member: MemberPolicyInput): boolean {
  return !isArchivedMember(member);
}

/**
 * UI policy: whose "Podaci i brisanje" section is shown. Archived tombstones
 * exist only to keep past events' participants, so their data can't be purged.
 */
export function canManageMemberData(member: MemberPolicyInput): boolean {
  return !isArchivedMember(member);
}


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

/**
 * Joins the family behind the invitation the user was actually shown.
 * The id is only a pointer — the database re-checks that it belongs to the
 * signed-in e-mail and is still pending.
 */
export async function acceptPendingInvitation(invitationId?: string | null): Promise<string | null> {
  const client = supabase as unknown as {
    rpc: (name: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await client.rpc("accept_family_invitation", {
    _invitation_id: invitationId ?? null,
  });
  if (error) return null;
  return (data as string | null) ?? null;
}

export type PendingInvitation = {
  id: string;
  family_id: string;
  family_name: string;
  role: "parent" | "child" | string;
};

/** Wording for the invite confirmation: existing accounts never get an e-mail. */
export function inviteResultMessage(result: { existingAccount?: boolean } | null | undefined) {
  return result?.existingAccount
    ? "Ta osoba već ima Tejla račun, pa e-mail poziv nije poslan. Neka se prijavi u Tejlu — poziv će je dočekati i može ga prihvatiti."
    : "Poziv je poslan.";
}

/** Read-only peek at a pending invitation. Never joins the family by itself. */
export async function fetchPendingInvitation(): Promise<PendingInvitation | null> {
  // Must stay bound to the client — a detached `supabase.rpc` reference throws.
  const client = supabase as unknown as {
    rpc: (name: string) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await client.rpc("pending_family_invitation");
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

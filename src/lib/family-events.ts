import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WHOLE_FAMILY } from "@/lib/family";
import type { ExtractedItem } from "@/lib/hub-store";
import { cancelPendingReminders, restorePausedReminders } from "@/lib/reminders";
import { notifyAssignment } from "@/lib/notifications.functions";

/**
 * Instant assignment push. Fire-and-forget: a push problem must never break
 * saving. The server deduplicates, so re-saving an unchanged assignee is quiet.
 */
function pingAssignees(eventId: string) {
  void notifyAssignment({ data: { eventId } }).catch(() => {
    // Never log the error payload: it can echo event content.
    console.error("ASSIGNMENT_PUSH_FAILED");
  });
}

export type FamilyEvent = {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  deadline: string;
  amount: string;
  things_to_bring: string[];
  /** Names of the family members this event belongs to. */
  members: string[];
  /** Ids of the family members this event belongs to. */
  member_ids: string[];
  /** "event" happens at a time; "task" is something to do and can be completed. */
  type: "event" | "task";
  completed: boolean;
  completed_at: string | null;
  /** Event this task belongs to ("Prije toga"). */
  linked_event_id: string | null;
  /** Who entered it; decides what a child member may change. */
  created_by: string | null;
};

const asText = (v: string | null | undefined) => (v ?? "").trim();
const emptyToNull = (v: string) => (v.trim() === "" ? null : v.trim());

/** "14:30:00" -> "14:30" */
function normalizeTime(v: string | null | undefined) {
  const t = asText(v);
  return t ? t.slice(0, 5) : "";
}

/** Accepts "14:30", "14.30", "14 h" and returns a Postgres time or null. */
function toDbTime(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})[:.h ]?(\d{2})?/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (!Number.isFinite(h) || h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
}

const toDbDate = (raw: string) => (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim()) ? raw.trim() : null);

export function useFamilyEvents(familyId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["family-events", familyId],
    enabled: Boolean(familyId),
    queryFn: async (): Promise<FamilyEvent[]> => {
      const { data, error } = await supabase
        .from("family_events")
        .select(
          "id, title, category, date, time, location, notes, deadline, amount, things_to_bring, type, completed, completed_at, linked_event_id, event_members(family_member_id, family_members(name))",
        )
        .eq("family_id", familyId!)
        .order("date", { ascending: true });
      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id,
        title: asText(row.title),
        category: asText(row.category),
        date: asText(row.date),
        time: normalizeTime(row.time),
        location: asText(row.location),
        notes: asText(row.notes),
        deadline: asText(row.deadline),
        amount: asText(row.amount),
        things_to_bring: Array.isArray(row.things_to_bring)
          ? (row.things_to_bring as unknown[]).map(String)
          : [],
        members: (row.event_members ?? [])
          .map((em) => asText(em.family_members?.name))
          .filter(Boolean),
        member_ids: (row.event_members ?? []).map((em) => em.family_member_id),
        type: row.type === "task" ? "task" : "event",
        completed: Boolean(row.completed),
        completed_at: row.completed_at,
        linked_event_id: row.linked_event_id,
      }));
    },
  });

  // Live sync between parents of the same family.
  // The topic must be unique per hook instance: several components can use this
  // hook at once (list + detail sheet), and reusing one topic makes supabase-js
  // throw "cannot add postgres_changes callbacks after subscribe()" — that throw
  // happens inside render/effect and blanks the whole screen.
  const channelIdRef = useRef<string | null>(null);
  if (!channelIdRef.current) channelIdRef.current = Math.random().toString(36).slice(2);
  useEffect(() => {
    if (!familyId) return;
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ["family-events", familyId] });
    const channel = supabase
      .channel(`family-events-${familyId}-${channelIdRef.current}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_events",
          filter: `family_id=eq.${familyId}`,
        },
        invalidate,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "event_members" }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId, queryClient]);

  return query;
}

type MemberRow = { id: string; name: string };

/** Saves one manually entered event plus its member links. */
export async function updateFamilyEvent(
  eventId: string,
  input: {
    title: string;
    date: string;
    time: string;
    location: string;
    notes: string;
    category?: string;
  },
  memberIds: string[],
) {
  const { error } = await supabase
    .from("family_events")
    .update({
      title: input.title.trim() || "Bez naziva",
      category: emptyToNull(input.category ?? ""),
      date: toDbDate(input.date),
      time: input.time.trim() ? toDbTime(input.time) : null,
      location: emptyToNull(input.location),
      notes: emptyToNull(input.notes),
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);
  if (error) throw error;

  const { error: delError } = await supabase.from("event_members").delete().eq("event_id", eventId);
  if (delError) throw delError;

  if (memberIds.length > 0) {
    const { error: linkError } = await supabase
      .from("event_members")
      .insert(memberIds.map((id) => ({ event_id: eventId, family_member_id: id })));
    if (linkError) throw linkError;
  }
  pingAssignees(eventId);
}

/** Marks a task done/undone. Completing it cancels every pending reminder. */
export async function setEventCompleted(eventId: string, completed: boolean) {
  const { error } = await supabase
    .from("family_events")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);
  if (error) throw error;
  if (completed) {
    await cancelPendingReminders(eventId);
  } else {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (userId) await restorePausedReminders(eventId, userId);
  }
}

export async function deleteFamilyEvent(eventId: string) {
  const { error } = await supabase.from("family_events").delete().eq("id", eventId);
  if (error) throw error;
}

export async function saveManualEvent(
  familyId: string,
  input: {
    title: string;
    date: string;
    time: string;
    location: string;
    notes: string;
    category?: string;
    type?: "event" | "task";
    linked_event_id?: string | null;
  },
  memberIds: string[],
) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Nisi prijavljen.");

  const { data: inserted, error } = await supabase
    .from("family_events")
    .insert({
      family_id: familyId,
      title: input.title.trim(),
      category: emptyToNull(input.category ?? ""),
      date: toDbDate(input.date),
      time: input.time.trim() ? toDbTime(input.time) : null,
      location: emptyToNull(input.location),
      notes: emptyToNull(input.notes),
      things_to_bring: [],
      type: input.type ?? "event",
      linked_event_id: input.linked_event_id ?? null,
      created_by: uid,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (memberIds.length > 0) {
    const { error: linkError } = await supabase
      .from("event_members")
      .insert(memberIds.map((id) => ({ event_id: inserted.id, family_member_id: id })));
    if (linkError) throw linkError;
  }

  pingAssignees(inserted.id as string);
  return inserted.id as string;
}

/** Saves confirmed AI items as family events plus their member links. */
export async function saveFamilyEvents(
  familyId: string,
  items: ExtractedItem[],
  members: MemberRow[],
) {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Nisi prijavljen.");

  const createdIds: string[] = new Array(items.length).fill("") as string[];
  // Events first, so a task extracted from the same sentence can link to one.
  const order = [
    ...items.map((it, i) => ({ it, i })).filter(({ it }) => it.type !== "task"),
    ...items.map((it, i) => ({ it, i })).filter(({ it }) => it.type === "task"),
  ];

  for (const { it: item, i: itemIndex } of order) {
    const { data: inserted, error } = await supabase
      .from("family_events")
      .insert({
        family_id: familyId,
        title: item.title.trim() || "Bez naziva",
        category: emptyToNull(item.category),
        date: toDbDate(item.date),
        time: item.time.trim() ? toDbTime(item.time) : null,
        location: emptyToNull(item.location),
        notes: emptyToNull(item.notes),
        deadline: toDbDate(item.deadline),
        amount: emptyToNull(item.amount),
        things_to_bring: item.things_to_bring,
        type: item.type === "task" ? "task" : "event",
        linked_event_id:
          item.type === "task" && item.link_to >= 0 ? (createdIds[item.link_to] || null) : null,
        created_by: uid,
      })
      .select("id")
      .single();
    if (error) throw error;

    const targets =
      item.assignee === WHOLE_FAMILY
        ? members
        : members.filter((m) => m.name.trim().toLowerCase() === item.assignee.trim().toLowerCase());

    if (targets.length > 0) {
      const { error: linkError } = await supabase
        .from("event_members")
        .insert(targets.map((m) => ({ event_id: inserted.id, family_member_id: m.id })));
      if (linkError) throw linkError;
    }
    createdIds[itemIndex] = inserted.id as string;
    pingAssignees(inserted.id as string);
  }

  return createdIds;
}

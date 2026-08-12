import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { WHOLE_FAMILY } from "@/lib/family";
import type { ExtractedItem } from "@/lib/hub-store";

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
          "id, title, category, date, time, location, notes, deadline, amount, things_to_bring, event_members(family_members(name))",
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
      }));
    },
  });

  // Live sync between parents of the same family.
  useEffect(() => {
    if (!familyId) return;
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ["family-events", familyId] });
    const channel = supabase
      .channel(`family-events-${familyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "family_events", filter: `family_id=eq.${familyId}` },
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
export async function saveManualEvent(
  familyId: string,
  input: {
    title: string;
    date: string;
    time: string;
    location: string;
    notes: string;
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
      date: toDbDate(input.date),
      time: input.time.trim() ? toDbTime(input.time) : null,
      location: emptyToNull(input.location),
      notes: emptyToNull(input.notes),
      things_to_bring: [],
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

  for (const item of items) {
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
  }
}
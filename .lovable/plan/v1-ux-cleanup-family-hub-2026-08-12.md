# V1 UX cleanup — Family Hub

Scope: UI simplification + child accounts with real (database-level) visibility control. Nothing about reminders, push, cron, VAPID, auth or the existing family sharing is rewritten.

## 1. Navigation and Inbox
- Bottom nav becomes 4 balanced items: Danas, Inbox, Kalendar, Članovi. The AI tab is removed from the bar.
- The AI analysis screen stops being a destination: its editable-results UI moves into a reusable component rendered inside Inbox. `/analiza` keeps existing (redirects to `/inbox`) so old links don't break.
- Inbox gets one primary action "+ Ubaci" that opens a sheet with: Fotografiraj, Odaberi iz galerije, PDF dokument, Zalijepi tekst, Upiši ručno. All existing pickers, upload code and the manual event form are reused as-is.
- After a submission the existing analysis runs automatically, showing "Pregledavam…", then "Pronađene su N stvari" with the same editable/removable/confirmable cards, uncertain fields flagged, and "Dodaj sve". Event + reminder creation logic is untouched.
- "Nedavno" section: lightweight, stored locally on the device (no new tables, no file storage) — entry type, time, and outcome ("3 obveze dodane", "Čeka potvrdu").

## 2. Calendar, Danas, wording
- Calendar stays a chronological list. Adds a "+" button that opens the existing manual event form in a sheet.
- Reminder text becomes friendlier: "🔔 danas u 13:55", "🔔 sutra u 19:00", date for anything further out. Display only.
- Member colors move to one shared helper that assigns a stable color per member id, used identically in Calendar, Danas, filters and member UI (replacing the hardcoded Mama/Tata/Lara list).
- Neutral copy: Calendar subtitle "Sve što te čeka, na jednom mjestu.", Inbox subtitle "Ubaci što god želiš zapamtiti. Pronaći ćemo što je važno.", no "AI analiza" wording, no assumptions about parents/children.
- Danas keeps its current structure; only colors and wording change.

## 3. Članovi
- Tab renamed to "Članovi" (backend names unchanged). Header shows the workspace name.
- Copy replaced with "Povezani članovi vide promjene odmah. Pristup djece možeš prilagoditi.", shown only when it applies.
- Two clear actions: "+ Dodaj člana" (profile without account) and "Pozovi osobu" (invitation, choose Odrasla osoba / Dijete). The existing secure invite flow is reused.
- Member rows become tappable and open a member detail sheet (name, account status, invite status, invite action for children, visibility settings for connected children). No auth details exposed.

## 4. Child accounts (additive schema only)
Smallest safe change on top of what exists:
- `family_invitations` gains `family_member_id` so a child invitation binds to the existing child profile — accepting links the account to that profile instead of creating a duplicate row.
- `family_users.role` accepts `child` in addition to `owner`/`parent`.
- New table `member_visibility` (one row per child member): mode = `own` | `own_shared` | `all` | `custom`, plus an allow-list of member ids and flags for own/shared events. Default on connect: `own_shared`. Only adults can write it.
- No table is recreated, no data deleted, no family recreated.

## 5. Child visibility enforced in the database
- New helper `is_family_adult(family_id)` (owner/parent only).
- New security-definer `can_view_event(event_id)`: adults keep exactly today's access; a child sees their own events, plus shared/unassigned ones, plus whatever their mode/allow-list permits.
- `family_events` select/update/delete, `event_members` and `event_reminders` policies switch from "any family member" to this function, so hidden rows cannot be fetched through the API at all — not just hidden in the UI.
- Adult access, family isolation and the existing invitation security stay as they are. Reminder sending (service role) is unaffected.

## Technical notes
- Reminder logic, `insertReminders`/`replaceReminders`, the cron endpoint, service worker, VAPID and push subscriptions are not edited.
- Migration is additive and backward compatible; existing events with no visibility rows behave exactly as today for adults.
- All changed screens keep safe-area padding, fixed bottom nav clearance and large tap targets.

## Verification
Typecheck plus a signed-in browser pass over Inbox (upload → analysis → save), Calendar (+ add, open/edit/delete, reminder badges), Danas and Članovi. Child visibility is verified with direct database queries as a child role, since a second device isn't available here.

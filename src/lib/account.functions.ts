import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccountDeletionPreview = {
  has_family: boolean;
  is_owner: boolean;
  other_users: number;
  deletes_family: boolean;
  needs_owner_transfer: boolean;
  blocked: boolean;
  adult_candidates: { user_id: string; name: string }[];
};

/** What happens if I delete my account right now. Reads only my own situation. */
export const previewAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("account_deletion_preview");
    if (error) throw new Error("Provjera računa nije uspjela.");
    return data as unknown as AccountDeletionPreview;
  });

/**
 * Permanently deletes the signed-in user's account.
 *
 * Two phases: app data (via a security-definer routine that only ever touches
 * auth.uid()), then the auth account itself. A ledger row survives the auth
 * user, so a failed second phase can be finished by simply calling this again.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { newOwnerUserId?: string | null } | undefined) => ({
    newOwnerUserId: input?.newOwnerUserId ? String(input.newOwnerUserId) : null,
  }))
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { error } = await context.supabase.rpc("delete_my_account", {
      _new_owner_user_id: data.newOwnerUserId,
    });
    if (error) {
      throw new Error(error.message || "Brisanje računa nije uspjelo.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    // "not found" means a previous attempt already got this far - keep going.
    if (authError && !/not\s*found/i.test(authError.message)) {
      throw new Error("Račun je pripremljen za brisanje, ali nije dovršen. Pokušaj ponovno.");
    }

    await supabaseAdmin
      .from("account_deletion_requests")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("user_id", userId);

    return { ok: true };
  });

/** Finishes an interrupted deletion when the user manages to sign in again. */
export const finishPendingAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("account_deletion_requests")
      .select("status")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!data || data.status === "completed") return { pending: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error && !/not\s*found/i.test(error.message)) return { pending: true };

    await supabaseAdmin
      .from("account_deletion_requests")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("user_id", context.userId);

    return { pending: false, finished: true };
  });

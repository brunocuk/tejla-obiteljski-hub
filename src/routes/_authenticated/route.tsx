import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { FamilyGate } from "@/components/FamilyGate";
import { OnboardingGate } from "@/components/Onboarding";
import { finishPendingAccountDeletion } from "@/lib/account.functions";
import { clearTejlaLocalData } from "@/lib/account-local";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // An interrupted account deletion must never leave a usable session behind.
    try {
      const res = await finishPendingAccountDeletion({ data: undefined });
      if (res?.finished) {
        clearTejlaLocalData();
        await supabase.auth.signOut().catch(() => undefined);
        clearTejlaLocalData();
        throw redirect({ to: "/auth" });
      }
    } catch (err) {
      if (err && typeof err === "object" && "to" in err) throw err;
    }

    return { user: data.user };
  },
  component: () => (
    <FamilyGate>
      <OnboardingGate>
        <Outlet />
      </OnboardingGate>
    </FamilyGate>
  ),
});

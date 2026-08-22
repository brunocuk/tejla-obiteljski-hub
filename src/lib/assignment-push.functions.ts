import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { notifyAssignmentForEvent } from "./assignment-push.server";

export const notifyAssignment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => input)
  .handler(async ({ data, context }) =>
    notifyAssignmentForEvent(data.eventId, context.userId),
  );

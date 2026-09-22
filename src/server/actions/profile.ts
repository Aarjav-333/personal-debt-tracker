"use server";

import { createClient } from "@/lib/supabase/server";
import { profileSettingsSchema } from "@/lib/validators";
import { AUTH_REQUIRED, fail, failValidation, mapDbError, ok, type ActionResult } from "@/server/action-result";
import { revalidateLedger } from "@/server/revalidate";

export async function updateProfileSettings(input: unknown): Promise<ActionResult> {
  const parsed = profileSettingsSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(AUTH_REQUIRED);

  // Upserted rather than updated: the row normally exists (created by the
  // on_auth_user_created trigger) but an account made before the trigger was
  // installed would otherwise have nowhere to save settings.
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      display_name: parsed.data.displayName,
      currency: parsed.data.currency,
    },
    { onConflict: "id" },
  );

  if (error) return mapDbError(error, "Could not save your settings.");

  revalidateLedger();
  return ok();
}

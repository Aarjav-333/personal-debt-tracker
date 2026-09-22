import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";
import type { Database } from "@/lib/types/database";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * It carries the signed-in user's session, so every query it issues is
 * filtered by Row Level Security exactly as if the browser had made it.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. Session refresh is handled
          // by the proxy (src/proxy.ts), so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * The signed-in user, or null.
 *
 * Always goes to the Supabase Auth server rather than trusting the cookie, so
 * a tampered session token can never be mistaken for a valid one. Wrapped in
 * cache() so a render that needs the user more than once (the layout guard and
 * the profile query, say) still costs a single round-trip.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

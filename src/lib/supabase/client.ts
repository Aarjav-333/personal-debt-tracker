"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";
import type { Database } from "@/lib/types/database";

let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Browser-side Supabase client.
 *
 * Used only for things that must happen in the browser: signing out, listening
 * for auth state changes and realtime refreshes. All reads and writes of
 * financial data go through Server Components and Server Actions instead.
 */
export function createClient() {
  cached ??= createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
  return cached;
}

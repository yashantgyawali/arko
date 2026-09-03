import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

type Client = SupabaseClient<Database>;

let client: Client | null = null;
let initError: Error | null = null;

export function createClient(): Client {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function getClient(): Client {
  if (client) return client;
  try {
    client = createClient();
    initError = null;
    return client;
  } catch (err) {
    initError = err instanceof Error ? err : new Error(String(err));
    throw initError;
  }
}

export function supabaseInitError(): Error | null {
  return initError;
}

/**
 * Lazily constructed.
 *
 * This used to be `export const supabase = createClient()`, which ran at
 * module-import time — so if construction threw (e.g. missing env, or a
 * browser API the library needs that is absent outside a secure context),
 * every module importing it failed to evaluate and React never mounted. The
 * page then rendered from server HTML with nothing wired up: inputs did
 * nothing, buttons did nothing, and no error could be reported.
 *
 * Deferring construction to first property access means any such failure
 * happens inside a caller's try/catch instead of taking down the whole app.
 */
export const supabase: Client = new Proxy({} as Client, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getClient() as object, prop, receiver);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});

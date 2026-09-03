"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

/**
 * Everyone gets an anonymous Supabase session — there is no login screen.
 *
 * Failures here used to be swallowed into console.error, which left `ready`
 * false forever and any button gated on it permanently disabled with no
 * explanation. The error is now returned so callers can say what went wrong,
 * and `ensure()` lets an action retry the sign-in on demand.
 */
export function useAnonAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ensure = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      setUserId(data.session.user.id);
      setError(null);
      return data.session.user.id;
    }
    const { data: signIn, error: signInError } = await supabase.auth.signInAnonymously();
    if (signInError) {
      setError(
        signInError.message?.toLowerCase().includes("anonymous")
          ? "Anonymous sign-in is disabled for this project, so nobody can join yet."
          : `Couldn't connect: ${signInError.message}`,
      );
      return null;
    }
    if (signIn.user) {
      setUserId(signIn.user.id);
      setError(null);
      return signIn.user.id;
    }
    setError("Couldn't start a session. Check your connection and try again.");
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    ensure().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't connect.");
    });
    return () => {
      cancelled = true;
    };
  }, [ensure]);

  return { userId, ready: !!userId, error, ensure };
}

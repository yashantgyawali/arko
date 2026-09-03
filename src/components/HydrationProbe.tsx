"use client";

import { useEffect } from "react";

/**
 * Sets a global flag once React has actually mounted, on EVERY page.
 *
 * This lived inside JoinForm, which meant the layout's 6s "React did not
 * mount" warning fired on every other route as a false alarm. Rendered from
 * the root layout so the signal means what it says.
 */
export function HydrationProbe() {
  useEffect(() => {
    (window as unknown as { __arkoHydrated?: boolean }).__arkoHydrated = true;
  }, []);
  return null;
}

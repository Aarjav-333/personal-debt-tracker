"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that makes the app installable and lets
 * previously visited screens open without a connection.
 *
 * Registration is skipped in development so an old cached bundle can never
 * shadow a code change.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // An unavailable service worker costs offline support and nothing else,
        // so there is no user-facing failure to report here.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}

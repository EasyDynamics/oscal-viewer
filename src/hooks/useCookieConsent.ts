/* ═══════════════════════════════════════════════════════════════════════════
   useCookieConsent — Manages cookie consent state via a single
   "cookie_consent" cookie.  Returns the current consent value and
   helpers to accept / decline.

   When consent changes, Google Analytics is dynamically loaded or
   disabled so that preference changes take effect immediately without
   requiring a page reload.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState, useCallback } from "react";

export type ConsentValue = "accepted" | "declined" | null;

const COOKIE_NAME = "cookie_consent";
const MAX_AGE_DAYS = 365;
const GA_ID = "G-J56BFX8610";

/** Read the current consent cookie (returns null if unset). */
function readConsent(): ConsentValue {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const val = match.split("=")[1];
  return val === "accepted" || val === "declined" ? val : null;
}

/** Write (or clear) the consent cookie. */
function writeConsent(value: ConsentValue) {
  if (value === null) {
    document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
  } else {
    const maxAge = MAX_AGE_DAYS * 24 * 60 * 60;
    document.cookie = `${COOKIE_NAME}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
  }
}

/* ── Google Analytics helpers ── */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean;
  }
}

let gaLoaded = false;

/** Dynamically inject GA if it hasn't been loaded yet. */
function enableGA() {
  if (gaLoaded) {
    // Re-enable if it was previously disabled
    window[`ga-disable-${GA_ID}`] = false;
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);

  gaLoaded = true;
}

/** Disable GA tracking and remove its cookies. */
function disableGA() {
  // Google's documented opt-out flag — prevents further hits
  window[`ga-disable-${GA_ID}`] = true;

  // Remove GA cookies (names follow _ga / _ga_<ID> pattern)
  const gaCookies = document.cookie
    .split("; ")
    .map((c) => c.split("=")[0])
    .filter((name) => name === "_ga" || name.startsWith("_ga_"));

  for (const name of gaCookies) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    // GA may set cookies on the root domain as well
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${location.hostname}; SameSite=Lax`;
  }
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentValue>(readConsent);

  const accept = useCallback(() => {
    writeConsent("accepted");
    setConsent("accepted");
    enableGA();
  }, []);

  const decline = useCallback(() => {
    writeConsent("declined");
    setConsent("declined");
    disableGA();
  }, []);

  return { consent, accept, decline } as const;
}

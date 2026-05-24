/* ═══════════════════════════════════════════════════════════════════════════
   useCookieConsent — Manages cookie consent state via a single
   "cookie_consent" cookie.  Returns the current consent value and
   helpers to accept / decline.

   When consent changes, Google Analytics is dynamically loaded or
   disabled so that preference changes take effect immediately without
   requiring a page reload.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState, useCallback, useEffect } from "react";

export type ConsentValue = "accepted" | "declined" | null;

const COOKIE_NAME = "cookie_consent";
const MAX_AGE_DAYS = 365;
const GA_ID = "G-J56BFX8610";
const CONSENT_CHANGED_EVENT = "oscal-cookie-consent-changed";

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
let lastPageView: { path: string; time: number } | null = null;

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
  window.gtag("config", GA_ID, { send_page_view: false });

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

function notifyConsentChanged() {
  window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
}

export function syncAnalyticsWithConsent() {
  if (readConsent() === "accepted") enableGA();
  else disableGA();
}

export function sanitizedAnalyticsPath(pathname: string, search = "", hash = "") {
  const params = new URLSearchParams(search);
  if (params.has("url")) params.set("url", "loaded");
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

export function viewerAnalyticsPath(pathname: string, search: string, viewId: string) {
  const params = new URLSearchParams(search);
  if (params.has("url")) params.set("url", "loaded");
  params.set("view", viewId);
  return `${pathname}?${params.toString()}`;
}

export function trackPageView(
  pagePath: string,
  pageTitle = document.title,
  params: Record<string, string> = {},
) {
  if (readConsent() !== "accepted") return;

  enableGA();

  const now = Date.now();
  if (lastPageView?.path === pagePath && now - lastPageView.time < 1000) return;
  lastPageView = { path: pagePath, time: now };

  window.gtag("event", "page_view", {
    page_path: pagePath,
    page_location: `${window.location.origin}${pagePath}`,
    page_title: pageTitle,
    ...params,
  });
}

export function onConsentChanged(listener: () => void) {
  window.addEventListener(CONSENT_CHANGED_EVENT, listener);
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, listener);
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentValue>(readConsent);

  useEffect(() => {
    syncAnalyticsWithConsent();
  }, []);

  const accept = useCallback(() => {
    writeConsent("accepted");
    setConsent("accepted");
    enableGA();
    notifyConsentChanged();
  }, []);

  const decline = useCallback(() => {
    writeConsent("declined");
    setConsent("declined");
    disableGA();
    notifyConsentChanged();
  }, []);

  return { consent, accept, decline } as const;
}

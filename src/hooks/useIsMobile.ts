/* ═══════════════════════════════════════════════════════════════════════════
   useIsMobile — reactive hook for mobile breakpoint detection (≤ 768px)
   ═══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect } from "react";

const MOBILE_QUERY = "(max-width: 768px)";

export default function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_QUERY).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { onConsentChanged, sanitizedAnalyticsPath, trackPageView } from "../hooks/useCookieConsent";

export default function AnalyticsPageTracker() {
  const location = useLocation();

  useEffect(() => {
    const pagePath = sanitizedAnalyticsPath(location.pathname, location.search, location.hash);
    const trackCurrentPage = () => trackPageView(pagePath);

    trackCurrentPage();
    return onConsentChanged(trackCurrentPage);
  }, [location.pathname, location.search, location.hash]);

  return null;
}

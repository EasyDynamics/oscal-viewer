import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { onConsentChanged, trackPageView, viewerAnalyticsPath } from "./useCookieConsent";

function readableViewName(viewId: string) {
  return viewId
    .replace(/^(ctrl|group|resource|res|comp|req|obs|risk|finding|poam|ssp-comp|leveraged-auth|ctrl-family)-/, "$1 ")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function useAnalyticsView(documentType: string, viewId: string) {
  const location = useLocation();

  useEffect(() => {
    const pagePath = viewerAnalyticsPath(location.pathname, location.search, viewId);
    const trackCurrentView = () => trackPageView(
      pagePath,
      `${documentType}: ${readableViewName(viewId)}`,
      {
        oscal_document_type: documentType,
        oscal_view: viewId,
      },
    );

    trackCurrentView();
    return onConsentChanged(trackCurrentView);
  }, [documentType, location.pathname, location.search, viewId]);
}

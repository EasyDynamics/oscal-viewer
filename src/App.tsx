import { BrowserRouter, Routes, Route } from "react-router-dom";
import { OscalProvider } from "./context/OscalContext";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import CatalogPage from "./pages/CatalogPage";
import ProfilePage from "./pages/ProfilePage";
import ComponentDefinitionPage from "./pages/ComponentDefinitionPage";
import SspPage from "./pages/SspPage";
import AssessmentPlanPage from "./pages/AssessmentPlanPage";
import AssessmentResultsPage from "./pages/AssessmentResultsPage";
import PoamPage from "./pages/PoamPage";
import ExamplesPage from "./pages/ExamplesPage";
import HowItWorksPage from "./pages/HowItWorksPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
    <OscalProvider>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="catalogs" element={<CatalogPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profiles" element={<ProfilePage />} />
          <Route path="component-definition" element={<ComponentDefinitionPage />} />
          <Route path="component-definitions" element={<ComponentDefinitionPage />} />
          <Route path="ssp" element={<SspPage />} />
          <Route path="system-security-plans" element={<SspPage />} />
          <Route path="assessment-plan" element={<AssessmentPlanPage />} />
          <Route path="assessment-plans" element={<AssessmentPlanPage />} />
          <Route path="assessment-results" element={<AssessmentResultsPage />} />
          <Route path="poam" element={<PoamPage />} />
          <Route path="plans-of-action-and-milestones" element={<PoamPage />} />
          <Route path="examples" element={<ExamplesPage />} />
          <Route path="how-it-works" element={<HowItWorksPage />} />
          <Route path="privacy" element={<PrivacyPolicyPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </OscalProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

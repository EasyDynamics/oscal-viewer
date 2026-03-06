import { BrowserRouter, Routes, Route } from "react-router-dom";
import { OscalProvider } from "./context/OscalContext";
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

export default function App() {
  return (
    <OscalProvider>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="component-definition" element={<ComponentDefinitionPage />} />
          <Route path="ssp" element={<SspPage />} />
          <Route path="assessment-plan" element={<AssessmentPlanPage />} />
          <Route path="assessment-results" element={<AssessmentResultsPage />} />
          <Route path="poam" element={<PoamPage />} />
          <Route path="examples" element={<ExamplesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </OscalProvider>
  );
}

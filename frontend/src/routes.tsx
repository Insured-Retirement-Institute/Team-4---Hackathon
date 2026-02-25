import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import NotFoundPage from './pages/NotFoundPage';
import HomePage from './pages/HomePage';
import ProductSelectionPage from './pages/ProductSelectionPage';
import DocusignReturnPage from './pages/DocusignReturnPage';
import WizardPageV2 from './features/wizard-v2/WizardPage';
import PrefillPage from './pages/PrefillPage';
import AIExperiencePage from './pages/AIExperiencePage';
import ApplicationHistoryPage from './pages/ApplicationHistoryPage';
import AppBuilderPage from './pages/appBuilder/AppBuilderPage';
import { ApplicationProvider } from './context/ApplicationContext';

function AppRoutes() {
  return (
    <ApplicationProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/docusign/return" element={<DocusignReturnPage />} />
          <Route path="/wizard-v2" element={<ProductSelectionPage />} />
          <Route path="/wizard-v2/:productId" element={<WizardPageV2 />} />
          <Route path="/prefill" element={<PrefillPage />} />
          <Route path="/ai-experience" element={<AIExperiencePage />} />
          <Route path="/applications" element={<ApplicationHistoryPage />} />
          <Route path="/app-builder" element={<AppBuilderPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ApplicationProvider>
  );
}

export default AppRoutes;

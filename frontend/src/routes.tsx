import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import NotFoundPage from './pages/NotFoundPage';
import HomePage from './pages/HomePage';
import ProductSelectionPage from './pages/ProductSelectionPage';
import DocusignReturnPage from './pages/DocusignReturnPage';
import WizardPage from './features/wizard-v1/WizardPage';
import WizardPageV2 from './features/wizard-v2/WizardPage';
import { ApplicationProvider } from './context/ApplicationContext';

function AppRoutes() {
  return (
    <ApplicationProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
<Route path="/docusign/return" element={<DocusignReturnPage />} />
          <Route path="/wizard-v1" element={<WizardPage />} />
          <Route path="/wizard-v2" element={<ProductSelectionPage />} />
          <Route path="/wizard-v2/:productId" element={<WizardPageV2 />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </ApplicationProvider>
  );
}

export default AppRoutes;

import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import NotFoundPage from './pages/NotFoundPage';
import WizardPage from './features/wizard-v1/WizardPage';

function AppRoutes() {
  return (
    <Routes>
      {/* Full-page routes (no AppBar) */}
      <Route path="/wizard-v1" element={<WizardPage />} />

      {/* Shell layout routes */}
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;

import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import NotFoundPage from './pages/NotFoundPage';
import HomePage from './pages/HomePage';
import AiChatPage from './pages/AiChatPage';
import WizardPage from './features/wizard-v1/WizardPage';
import WizardPageV2 from './features/wizard-v2/WizardPage';

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/ai-chat" element={<AiChatPage />} />
        <Route path="/wizard-v1" element={<WizardPage />} />
        <Route path="/wizard-v2" element={<WizardPageV2 />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;

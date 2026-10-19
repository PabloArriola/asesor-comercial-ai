import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChatbotProvider } from './context/ChatbotContext';
import AdminDashboard from './pages/AdminDashboard';
import ClientDashboard from './pages/ClientDashboard';
import ChatStandalone from './pages/ChatStandalone';
import ChatWidget from './components/ChatWidget';
import { useLocation } from 'react-router-dom';

function isRunningInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function AppContent() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isEmbedRequested = searchParams.get('embed') === 'true' || searchParams.get('widget') === 'true';
  const isIframe = isRunningInIframe() || isEmbedRequested;
  const isChatOnly = location.pathname === '/chat' || isIframe;

  return (
    <>
      <Routes>
        <Route path="/" element={isIframe ? <ChatStandalone /> : <AdminDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/client-dashboard" element={<ClientDashboard />} />
        <Route path="/chat" element={<ChatStandalone />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isChatOnly && <ChatWidget />}
    </>
  );
}

export default function App() {
  return (
    <ChatbotProvider>
      <Router>
        <AppContent />
      </Router>
    </ChatbotProvider>
  );
}

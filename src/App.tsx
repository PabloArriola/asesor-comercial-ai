import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ChatbotProvider } from './context/ChatbotContext';
import AdminDashboard from './pages/AdminDashboard';
import ClientDashboard from './pages/ClientDashboard';
import ChatStandalone from './pages/ChatStandalone';
import ChatWidget from './components/ChatWidget';
import { useLocation } from 'react-router-dom';

function AppContent() {
  const location = useLocation();
  const isChatOnly = location.pathname === '/chat';

  return (
    <>
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
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

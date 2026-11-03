import React, { Component, ErrorInfo, ReactNode } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ChatbotProvider } from './context/ChatbotContext';
import AdminDashboard from './pages/AdminDashboard';
import ClientDashboard from './pages/ClientDashboard';
import ChatStandalone from './pages/ChatStandalone';
import ChatWidget from './components/ChatWidget';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-200 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
              !
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Ocurrió un error inesperado</h2>
            <p className="text-sm text-slate-500 mb-6">
              {this.state.error?.message || 'Hubo un inconveniente al cargar esta sección.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow transition-colors cursor-pointer text-sm"
            >
              Recargar la aplicación
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <ErrorBoundary>
      <ChatbotProvider>
        <Router>
          <AppContent />
        </Router>
      </ChatbotProvider>
    </ErrorBoundary>
  );
}

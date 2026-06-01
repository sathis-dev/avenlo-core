import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { SovereignProvider } from './components/sovereign';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Moderation from './pages/Moderation';
import Guardian from './pages/Guardian';
import Kinetics from './pages/Kinetics';
import CommandCenter from './pages/CommandCenter';
import Tickets from './pages/Tickets';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import WelcomeConfig from './pages/WelcomeConfig';
import RulesConfig from './pages/RulesConfig';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-avenlo-darker flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-avenlo-border border-t-avenlo-cyan rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <SovereignProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/members" element={<Members />} />
                  <Route path="/moderation" element={<Moderation />} />
                  <Route path="/guardian" element={<Guardian />} />
                  <Route path="/kinetics" element={<Kinetics />} />
                  <Route path="/command" element={<CommandCenter />} />
                  <Route path="/tickets" element={<Tickets />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/logs" element={<Logs />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/welcome" element={<WelcomeConfig />} />
                  <Route path="/rules" element={<RulesConfig />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </SovereignProvider>
  );
}

export default App;

import React from 'react';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import LandingPage from './pages/Landing/Landing.jsx';
import Auth from './pages/Auth/Auth.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import History from './pages/History/History.jsx';
import Meeting from './pages/Meeting/Meeting.jsx';
import Settings from './pages/Settings/Settings.jsx';
import NotFound from './pages/NotFound/NotFound.jsx';
import ResetPassword from './pages/ResetPassword/ResetPassword.jsx';

import { useParams, Navigate } from 'react-router-dom';

const RoomRouteOrNotFound = () => {
  const { url } = useParams();
  // Match standard room code pattern (e.g. abc-defg-hij) or redirect to meet route
  const isMeetingPattern = url && (
    /^[a-zA-Z0-9]{3}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{3}$/.test(url) ||
    url.toLowerCase().startsWith('meet-')
  );
  if (isMeetingPattern) {
    return <Meeting />;
  }
  return <NotFound />;
};

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/home" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/meet/:url" element={<Meeting />} />
              <Route path="/:url" element={<RoomRouteOrNotFound />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;

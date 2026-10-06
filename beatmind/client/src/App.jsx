import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { useAuth } from './lib/auth.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import BeatAI from './pages/BeatAI.jsx';
import VoiceAI from './pages/VoiceAI.jsx';
import Studio from './pages/Studio.jsx';
import Library from './pages/Library.jsx';
import Community from './pages/Community.jsx';
import Producer from './pages/Producer.jsx';
import Profile from './pages/Profile.jsx';
import EqBars from './components/ui/EqBars.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="grid h-[60vh] place-items-center"><EqBars /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route path="/beat" element={<RequireAuth><BeatAI /></RequireAuth>} />
        <Route path="/voice" element={<RequireAuth><VoiceAI /></RequireAuth>} />
        <Route path="/studio" element={<RequireAuth><Studio /></RequireAuth>} />
        <Route path="/library" element={<RequireAuth><Library /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
        <Route path="/community" element={<Community />} />
        <Route path="/producer/:id" element={<Producer />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

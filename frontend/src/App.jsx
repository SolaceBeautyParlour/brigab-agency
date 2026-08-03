import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import { ListChecks } from "lucide-react";
import Header from "./components/Header.jsx";
import Browse from "./pages/Browse.jsx";
import HostelDetail from "./pages/HostelDetail.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ManagerDashboard from "./pages/ManagerDashboard.jsx";
import PaymentCallback from "./pages/PaymentCallback.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import { sessionAuth } from "./api/client.js";

export default function App() {
  const [user, setUser] = useState(sessionAuth.user);

  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <Header user={user} onLogout={() => setUser(null)} />

      <main>
        <Routes>
          <Route path="/" element={<Browse />} />
          <Route path="/hostels/:id" element={<HostelDetail />} />
          <Route path="/login" element={<Login onAuthed={setUser} />} />
          <Route path="/signup" element={<Signup onAuthed={setUser} />} />
          <Route
            path="/dashboard"
            element={<RequireAuth role="student"><Dashboard /></RequireAuth>}
          />
          <Route
            path="/manager"
            element={<RequireAuth role="manager"><ManagerDashboard /></RequireAuth>}
          />
          <Route
            path="/payment-callback"
            element={<RequireAuth role="student"><PaymentCallback /></RequireAuth>}
          />
        </Routes>
      </main>

      <footer className="px-6 sm:px-10 py-8 border-t border-ink/10 flex items-center justify-between text-xs text-ink/40">
        <span>Brigab Agency · Kumasi</span>
        <span className="flex items-center gap-1.5"><ListChecks size={13} /> KNUST academic year 2026/27</span>
      </footer>
    </div>
  );
}

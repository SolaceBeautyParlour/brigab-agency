import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { api, sessionAuth } from "../api/client.js";
import PasswordField from "../components/PasswordField.jsx";

export default function Login({ onAuthed }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const { user, token } = await api.login({ email, password });
      sessionAuth.token = token;
      sessionAuth.user = user;
      onAuthed(user);
      navigate(user.role === "manager" ? "/manager" : location.state?.redirectTo || "/dashboard");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-16">
      <h1 className="font-display text-2xl text-ink mb-6">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="login-email" className="sr-only">Email</label>
          <input
            id="login-email"
            type="email" required placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-rust"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="sr-only">Password</label>
          <PasswordField
            id="login-password"
            required placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p role="alert" className="text-rust text-sm">{error}</p>}
        <button type="submit" className="w-full bg-ink text-paper rounded-full py-2.5 font-medium hover:bg-rust outline-none focus-visible:ring-2 focus-visible:ring-rust focus-visible:ring-offset-2">
          Log in
        </button>
      </form>
      <p className="text-sm text-ink/50 mt-4">
        No account? <Link to="/signup" className="text-rust font-medium">Sign up</Link>
      </p>
    </div>
  );
}

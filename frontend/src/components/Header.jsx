import { Link, useNavigate } from "react-router-dom";
import { Wallet } from "lucide-react";
import { sessionAuth } from "../api/client.js";

export default function Header({ user, onLogout }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur border-b border-ink/10 px-6 sm:px-10 py-4 flex items-center justify-between">
      <Link to="/" className="font-display text-xl tracking-tight text-ink flex items-baseline gap-1.5">
        <span className="font-semibold">Brigab</span>
        <span className="font-normal text-rust">Agency</span>
      </Link>

      <div className="flex items-center gap-4">
        {!user && (
          <>
            <Link to="/login" className="text-sm text-ink/60 hover:text-ink">Log in</Link>
            <Link to="/signup" className="text-sm font-medium bg-ink text-paper px-4 py-2 rounded-full hover:bg-rust">
              Sign up
            </Link>
          </>
        )}

        {user?.role === "student" && (
          <Link to="/dashboard" className="flex items-center gap-1.5 text-sm font-medium text-ink/70 hover:text-rust">
            <Wallet size={15} /> My bookings
          </Link>
        )}

        {user?.role === "manager" && (
          <Link to="/manager" className="text-sm font-medium text-ink/70 hover:text-rust">
            Manager tools
          </Link>
        )}

        {user && (
          <button
            onClick={() => {
              sessionAuth.token = null;
              sessionAuth.user = null;
              onLogout();
              navigate("/");
            }}
            className="text-sm text-ink/40 hover:text-ink"
          >
            Log out
          </button>
        )}
      </div>
    </header>
  );
}

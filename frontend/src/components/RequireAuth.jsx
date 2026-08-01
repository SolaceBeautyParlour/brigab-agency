import { Navigate, useLocation } from "react-router-dom";
import { sessionAuth } from "../api/client.js";

/**
 * Wraps a protected route. No silent failures: if you're not logged in
 * (or logged in as the wrong role), you're redirected to /login with
 * enough state for it to send you back here afterward — never left to
 * hit a raw 401 from the API after clicking something.
 */
export default function RequireAuth({ role, children }) {
  const location = useLocation();
  const user = sessionAuth.user;

  if (!user) {
    return <Navigate to="/login" state={{ redirectTo: location.pathname }} replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, sessionAuth } from "../api/client.js";
import PasswordField from "../components/PasswordField.jsx";

export default function Signup({ onAuthed }) {
  const [role, setRole] = useState("student");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", gender: "" });
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const { user, token } = await api.signup({ role, ...form });
      sessionAuth.token = token;
      sessionAuth.user = user;
      onAuthed(user);
      navigate(role === "manager" ? "/manager" : "/dashboard");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="max-w-sm mx-auto px-6 py-16">
      <h1 className="font-display text-2xl text-ink mb-1">Create an account</h1>
      <p className="text-sm text-ink/50 mb-6">Managers list hostels for free. Students book rooms.</p>

      <div className="flex bg-ink/[0.05] rounded-full p-1 mb-6" role="radiogroup" aria-label="Account type">
        {["student", "manager"].map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={role === r}
            onClick={() => setRole(r)}
            className={`flex-1 px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors outline-none focus-visible:ring-2 focus-visible:ring-rust ${
              role === r ? "bg-white shadow-sm text-ink" : "text-ink/50"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="su-name" className="sr-only">Full name</label>
          <input id="su-name" required placeholder="Full name" value={form.name} onChange={update("name")}
            className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-rust" />
        </div>
        <div>
          <label htmlFor="su-email" className="sr-only">Email</label>
          <input id="su-email" required type="email" placeholder="Email" value={form.email} onChange={update("email")}
            className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-rust" />
        </div>
        <div>
          <label htmlFor="su-phone" className="sr-only">Ghana phone number</label>
          <input id="su-phone" required placeholder="Phone (024xxxxxxx)" value={form.phone} onChange={update("phone")}
            aria-describedby="su-phone-hint"
            className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-rust" />
          <span id="su-phone-hint" className="sr-only">Format: 0 followed by 9 digits, e.g. 024 123 4567</span>
        </div>
        {role === "student" && (
          <fieldset>
            <legend className="text-xs text-ink/50 mb-1.5">
              Gender — used to keep rooms from mixing genders
            </legend>
            <div className="flex gap-2">
              {["male", "female"].map((g) => (
                <label
                  key={g}
                  className={`flex-1 text-center capitalize text-sm border rounded-lg py-2.5 cursor-pointer transition-colors ${
                    form.gender === g ? "bg-ink text-paper border-ink" : "border-ink/15 text-ink/60"
                  }`}
                >
                  <input
                    type="radio" name="gender" value={g} checked={form.gender === g}
                    onChange={update("gender")} className="sr-only" required
                  />
                  {g}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div>
          <label htmlFor="su-password" className="sr-only">Password, minimum 8 characters</label>
          <PasswordField
            id="su-password"
            required placeholder="Password (min 8 characters)" value={form.password} onChange={update("password")}
          />
        </div>
        {error && <p role="alert" className="text-rust text-sm">{error}</p>}
        <button type="submit" className="w-full bg-ink text-paper rounded-full py-2.5 font-medium hover:bg-rust outline-none focus-visible:ring-2 focus-visible:ring-rust focus-visible:ring-offset-2">
          Create account
        </button>
      </form>
      <p className="text-sm text-ink/50 mt-4">
        Already have one? <Link to="/login" className="text-rust font-medium">Log in</Link>
      </p>
    </div>
  );
}

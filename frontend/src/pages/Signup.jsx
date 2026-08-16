import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, sessionAuth } from "../api/client.js";
import PasswordField from "../components/PasswordField.jsx";

export default function Signup({ onAuthed }) {
  const [role, setRole] = useState("student");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", gender: "" });
  const [error, setError] = useState(null);
  const [step, setStep] = useState("form"); // form | photo
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
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
      // Students get an optional photo step right after account creation —
      // managers don't need one, so they go straight in.
      if (role === "student") {
        setStep("photo");
      } else {
        navigate("/manager");
      }
    } catch (e) {
      setError(e.message);
    }
  }

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoError("");
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handlePhotoUpload() {
    if (!photoFile) return;
    setUploadingPhoto(true);
    setPhotoError("");
    try {
      const { profilePhotoUrl } = await api.uploadProfilePhoto(photoFile);
      sessionAuth.user = { ...sessionAuth.user, profile_photo_url: profilePhotoUrl };
      navigate("/dashboard");
    } catch (err) {
      setPhotoError(err.message || "Couldn't upload that photo. You can add one later.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (step === "photo") {
    return (
      <div className="max-w-sm mx-auto px-6 py-16 text-center">
        <h1 className="font-display text-2xl text-ink mb-1">Add a profile photo?</h1>
        <p className="text-sm text-ink/50 mb-6">
          Helps hostel managers recognize who's booking. Totally optional — skip if you'd rather not.
        </p>

        <div className="w-28 h-28 rounded-full mx-auto mb-5 bg-ink/[0.06] overflow-hidden flex items-center justify-center border border-ink/10">
          {photoPreview ? (
            <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-ink/30 text-xs">No photo</span>
          )}
        </div>

        <label className="inline-block text-sm font-medium text-ink underline underline-offset-4 hover:text-rust cursor-pointer mb-4">
          {photoFile ? "Choose a different photo" : "Choose a photo"}
          <input type="file" accept="image/*" onChange={handlePhotoSelect} className="sr-only" />
        </label>

        {photoError && <p role="alert" className="text-rust text-sm mb-3">{photoError}</p>}

        <div className="flex flex-col gap-2 mt-2">
          <button
            type="button"
            onClick={handlePhotoUpload}
            disabled={!photoFile || uploadingPhoto}
            className="w-full bg-ink text-paper rounded-full py-2.5 font-medium hover:bg-rust disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-rust flex items-center justify-center gap-2"
          >
            {uploadingPhoto ? <Loader2 size={16} className="animate-spin" /> : null}
            {uploadingPhoto ? "Uploading…" : "Save and continue"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-sm text-ink/50 hover:text-ink py-1"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
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

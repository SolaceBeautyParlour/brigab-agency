import { useEffect, useState, useRef, useId } from "react";
import { Wrench, Plus, Banknote, X } from "lucide-react";
import { api } from "../api/client.js";
import BedGrid from "../components/BedGrid.jsx";
import AmenityChips from "../components/AmenityChips.jsx";
import MediaGallery from "../components/MediaGallery.jsx";
import LoadingState from "../components/LoadingState.jsx";

export default function ManagerDashboard() {
  const [hostels, setHostels] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNewHostel, setShowNewHostel] = useState(false);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [deletingRoom, setDeletingRoom] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [bookings, setBookings] = useState([]);

  const active = hostels.find((h) => h.id === activeId);

  function refreshHostels() {
    setLoadError("");
    api.managerHostels()
      .then((list) => {
        setHostels(list);
        if (!activeId && list.length) setActiveId(list[0].id);
      })
      .catch((err) => setLoadError(err.message || "Couldn't load your hostels."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { refreshHostels(); }, []);

  useEffect(() => {
    if (activeId) api.managerBookings(activeId).then(setBookings);
  }, [activeId]);

  async function toggleBed(bedId, status, currentStatus) {
    const isRiskyUncheck = currentStatus === "taken" && status !== "taken";

    if (!isRiskyUncheck) {
      // Safe case: update locally right away — no reason to make the manager
      // wait on a round trip to Render (a real, noticeable delay testing from
      // Ghana) just to see a bed flip. Roll back if the request fails.
      const previous = hostels;
      setHostels((prev) =>
        prev.map((h) =>
          h.id !== activeId
            ? h
            : { ...h, rooms: h.rooms.map((r) => ({ ...r, beds: r.beds.map((b) => (b.id === bedId ? { ...b, status } : b)) })) }
        )
      );
      try {
        await api.toggleBed(bedId, status);
      } catch (err) {
        setHostels(previous);
      }
      return;
    }

    // Risky case: this might displace a paying student. Wait for the
    // server's answer before touching the UI at all.
    try {
      await api.toggleBed(bedId, status);
    } catch (err) {
      if (err.data?.booking) {
        const b = err.data.booking;
        const confirmed = window.confirm(
          `${b.studentName} (${b.studentPhone}) has an active booking on this bed — they paid ₵${b.depositAmount}.\n\n` +
          `Marking this bed available will CANCEL their booking. This can't be undone from here.\n\n` +
          `Are you sure?`
        );
        if (!confirmed) return;

        try {
          await api.toggleBed(bedId, status, true);
        } catch (err2) {
          alert(err2.message || "Couldn't update this bed.");
          return;
        }
      } else {
        alert(err.message || "Couldn't update this bed.");
        return;
      }
    }

    setHostels((prev) =>
      prev.map((h) =>
        h.id !== activeId
          ? h
          : { ...h, rooms: h.rooms.map((r) => ({ ...r, beds: r.beds.map((b) => (b.id === bedId ? { ...b, status } : b)) })) }
      )
    );
  }

  async function confirmDeleteRoom() {
    setDeleteError("");
    try {
      await api.deleteRoom(deletingRoom.id);
      setDeletingRoom(null);
      refreshHostels();
    } catch (err) {
      setDeleteError(err.message || "Couldn't delete this room.");
    }
  }

  if (loading) return <LoadingState message="Loading your hostels…" fullPage />;

  if (loadError && hostels.length === 0) {
    return (
      <div className="px-6 sm:px-10 py-16 text-center">
        <p className="text-sm text-ink/60 mb-4">{loadError}</p>
        <button
          onClick={() => { setLoading(true); refreshHostels(); }}
          className="bg-ink text-paper rounded-full px-5 py-2 text-sm font-medium hover:bg-rust"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 sm:px-10 py-8 max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <Wrench size={16} className="text-rust" />
        <p className="font-mono text-[11px] uppercase tracking-wide text-ink/50">Manager tools · free, no subscription</p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl text-ink">Your hostels</h2>
        <button
          type="button"
          onClick={() => setShowNewHostel(true)}
          className="flex items-center gap-1.5 text-sm font-medium bg-ink text-paper px-4 py-2 rounded-full hover:bg-rust outline-none focus-visible:ring-2 focus-visible:ring-rust focus-visible:ring-offset-2"
        >
          <Plus size={14} /> Add hostel
        </button>
      </div>

      {hostels.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap" role="tablist" aria-label="Your hostels">
          {hostels.map((h) => (
            <button
              key={h.id}
              type="button"
              role="tab"
              aria-selected={activeId === h.id}
              onClick={() => setActiveId(h.id)}
              className={`text-sm px-3 py-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-rust focus-visible:ring-offset-2 ${activeId === h.id ? "bg-ink text-paper" : "bg-ink/[0.06] text-ink/60"}`}
            >
              {h.name}
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="mb-6">
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink/50 mb-1.5">
            {active.name} — cover photos
          </p>
          <MediaGallery
            key={active.id}
            initialItems={active.media}
            managerMode
            uploadFn={(file) => api.uploadHostelMedia(active.id, file)}
            altLabel={`${active.name} cover photo`}
            onChanged={refreshHostels}
          />
        </div>
      )}

      {active && !active.paystack_subaccount_code && (
        <div role="status" className="border border-gold/30 bg-gold/10 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Banknote size={18} className="text-[#7a5c14] mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-[#7a5c14] mb-1">Connect your bank account</p>
            <p className="text-xs text-ink/60">
              Deposits pay out straight to you via Paystack — Brigab never holds your rent money.
              Set this up once before students can reserve rooms at this hostel.
            </p>
            <ConnectPaystackForm hostelId={active.id} onDone={refreshHostels} />
          </div>
        </div>
      )}

      {active && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg text-ink">{active.name} — bed status</h3>
            <button
              type="button"
              onClick={() => setShowNewRoom(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-ink/60 hover:text-rust outline-none focus-visible:ring-2 focus-visible:ring-rust rounded"
            >
              <Plus size={13} /> Add room
            </button>
          </div>
          <p className="text-sm text-ink/60 mb-4 max-w-md">
            Tap a bed to mark it taken or free. Changes appear instantly on the student-facing site.
          </p>
          {active.rooms?.length ? (
            <BedGrid
              rooms={active.rooms}
              managerMode
              onToggleBed={toggleBed}
              onEditRoom={setEditingRoom}
              onDeleteRoom={(room) => { setDeleteError(""); setDeletingRoom(room); }}
            />
          ) : (
            <p className="text-sm text-ink/40">No rooms added yet.</p>
          )}

          <h3 className="font-display text-lg text-ink mt-10 mb-3">Bookings at {active.name}</h3>
          {bookings.length === 0 ? (
            <p className="text-sm text-ink/40">No bookings yet.</p>
          ) : (
            <div className="space-y-2">
              {bookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between border border-ink/10 rounded-lg px-4 py-3 text-sm">
                  <div>
                    <p className="text-ink">{b.student_name} · Room {b.room_code}</p>
                    <p className="text-ink/40 text-xs">{b.student_phone}</p>
                  </div>
                  <span className="font-mono text-xs text-ink/60 uppercase">{b.status}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showNewHostel && (
        <NewHostelModal onClose={() => setShowNewHostel(false)} onCreated={() => { setShowNewHostel(false); refreshHostels(); }} />
      )}
      {showNewRoom && active && (
        <NewRoomModal hostelId={active.id} onClose={() => setShowNewRoom(false)} onCreated={() => { setShowNewRoom(false); refreshHostels(); }} />
      )}
      {editingRoom && (
        <NewRoomModal
          hostelId={active.id}
          existingRoom={editingRoom}
          onClose={() => setEditingRoom(null)}
          onCreated={() => { setEditingRoom(null); refreshHostels(); }}
        />
      )}
      {deletingRoom && (
        <Modal onClose={() => setDeletingRoom(null)} title={`Delete room ${deletingRoom.room_code}?`}>
          <p className="text-sm text-ink/60 mb-4">
            This removes the room and its beds for students browsing the site. This can't be undone.
            If the room has any booking history, deletion will be blocked instead.
          </p>
          {deleteError && <p role="alert" className="text-rust text-sm mb-3">{deleteError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDeletingRoom(null)}
              className="flex-1 border border-ink/15 rounded-full py-2.5 text-sm font-medium hover:bg-ink/5 outline-none focus-visible:ring-2 focus-visible:ring-rust"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteRoom}
              className="flex-1 bg-rust text-paper rounded-full py-2.5 text-sm font-medium hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-rust"
            >
              Delete room
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ConnectPaystackForm({ hostelId, onDone }) {
  const [form, setForm] = useState({ businessName: "", bankCode: "", accountNumber: "" });
  const [banks, setBanks] = useState([]);
  const [banksError, setBanksError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listBanks()
      .then(setBanks)
      .catch((err) => setBanksError(err.message || "Couldn't load the bank list."));
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.connectPaystack(hostelId, form);
      onDone();
    } catch (err) {
      setError(err.message || "Couldn't connect this account. Double-check the account number and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 mt-3">
      <div className="flex-1">
        <label htmlFor="ps-business" className="sr-only">Business or account name</label>
        <input id="ps-business" required placeholder="Business/account name" value={form.businessName}
          onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
          className="border border-ink/15 rounded-lg px-3 py-2 text-xs w-full outline-none focus-visible:ring-2 focus-visible:ring-rust" />
      </div>
      <div className="w-40">
        <label htmlFor="ps-bank" className="sr-only">Bank</label>
        <select
          id="ps-bank"
          required
          value={form.bankCode}
          disabled={!banks.length}
          onChange={(e) => setForm((f) => ({ ...f, bankCode: e.target.value }))}
          className="border border-ink/15 rounded-lg px-3 py-2 text-xs w-full outline-none focus-visible:ring-2 focus-visible:ring-rust disabled:bg-ink/5 disabled:text-ink/40 bg-white"
        >
          <option value="" disabled>
            {banksError ? "Bank list unavailable" : banks.length ? "Select bank" : "Loading banks…"}
          </option>
          {banks.map((b) => (
            <option key={b.code} value={b.code}>{b.name}</option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <label htmlFor="ps-account" className="sr-only">Account number</label>
        <input id="ps-account" required placeholder="Account number" value={form.accountNumber}
          onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))}
          className="border border-ink/15 rounded-lg px-3 py-2 text-xs w-full outline-none focus-visible:ring-2 focus-visible:ring-rust" />
      </div>
      <button disabled={busy} className="bg-ink text-paper rounded-lg px-4 py-2 text-xs font-medium hover:bg-rust outline-none focus-visible:ring-2 focus-visible:ring-rust disabled:opacity-60">
        {busy ? "Connecting…" : "Connect"}
      </button>
      {banksError && <p role="alert" className="text-rust text-xs sm:col-span-4 w-full mt-1">{banksError} — you can still try again by reopening this section.</p>}
      {error && <p role="alert" className="text-rust text-xs sm:col-span-4 w-full mt-1">{error}</p>}
    </form>
  );
}

function NewHostelModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", area: "", genderPolicy: "mixed", depositPct: 0.35, includes: [] });
  const [error, setError] = useState("");
  const [amenityOptions, setAmenityOptions] = useState([]);

  useEffect(() => {
    api.amenityOptions().then((opts) => setAmenityOptions(opts.hostelAmenities)).catch(() => {});
  }, []);

  function toggleAmenity(item) {
    setForm((f) => ({
      ...f,
      includes: f.includes.includes(item) ? f.includes.filter((a) => a !== item) : [...f.includes, item],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.createHostel(form);
      onCreated();
    } catch (err) {
      setError(err.message || "Couldn't create the hostel. Try again.");
    }
  }

  return (
    <Modal onClose={onClose} title="Add a hostel">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="h-name" className="sr-only">Hostel name</label>
          <input id="h-name" required placeholder="Hostel name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-rust" />
        </div>
        <div>
          <label htmlFor="h-area" className="sr-only">Area</label>
          <input id="h-area" required placeholder="Area (e.g. Ayeduase)" value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
            className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-rust" />
        </div>
        <div>
          <label htmlFor="h-gender" className="text-xs text-ink/50 block mb-1">Gender policy</label>
          <select id="h-gender" value={form.genderPolicy} onChange={(e) => setForm((f) => ({ ...f, genderPolicy: e.target.value }))}
            className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-rust">
            <option value="mixed">Mixed</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <label htmlFor="h-deposit" className="text-xs text-ink/50 block">
          Deposit percentage: <span aria-live="polite">{Math.round(form.depositPct * 100)}%</span>
          <input id="h-deposit" type="range" min="0.1" max="1" step="0.05" value={form.depositPct}
            aria-valuetext={`${Math.round(form.depositPct * 100)} percent`}
            onChange={(e) => setForm((f) => ({ ...f, depositPct: Number(e.target.value) }))}
            className="w-full outline-none focus-visible:ring-2 focus-visible:ring-rust" />
        </label>
        {amenityOptions.length > 0 && (
          <div className="max-h-40 overflow-y-auto border border-ink/10 rounded-lg p-3">
            <AmenityChips
              options={amenityOptions}
              selected={form.includes}
              onToggle={toggleAmenity}
              label="Hostel amenities (property-wide)"
            />
          </div>
        )}
        <button type="submit" className="w-full bg-ink text-paper rounded-full py-2.5 font-medium hover:bg-rust outline-none focus-visible:ring-2 focus-visible:ring-rust">
          Create hostel
        </button>
        {error && <p role="alert" className="text-rust text-sm">{error}</p>}
      </form>
    </Modal>
  );
}

function NewRoomModal({ hostelId, existingRoom, onClose, onCreated }) {
  const isEditing = Boolean(existingRoom);
  const [form, setForm] = useState(
    existingRoom
      ? { roomCode: existingRoom.room_code, roomType: existingRoom.room_type, pricePerYear: existingRoom.price_per_year, bedCount: existingRoom.beds.length, amenities: existingRoom.amenities || [] }
      : { roomCode: "", roomType: "2-in-1", pricePerYear: "", bedCount: 2, amenities: [] }
  );
  const [error, setError] = useState("");
  const [amenityOptions, setAmenityOptions] = useState([]);

  useEffect(() => {
    api.amenityOptions().then((opts) => setAmenityOptions(opts.roomAmenities)).catch(() => {});
  }, []);

  function toggleAmenity(item) {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(item) ? f.amenities.filter((a) => a !== item) : [...f.amenities, item],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      if (isEditing) {
        await api.editRoom(existingRoom.id, { roomCode: form.roomCode, roomType: form.roomType, pricePerYear: Number(form.pricePerYear), amenities: form.amenities });
      } else {
        await api.createRoom(hostelId, { ...form, pricePerYear: Number(form.pricePerYear), bedCount: Number(form.bedCount) });
      }
      onCreated();
    } catch (err) {
      setError(err.message || `Couldn't ${isEditing ? "save" : "create"} this room.`);
    }
  }

  return (
    <Modal onClose={onClose} title={isEditing ? `Edit room ${existingRoom.room_code}` : "Add a room"}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="r-code" className="sr-only">Room code</label>
          <input id="r-code" required placeholder="Room code (e.g. A1)" value={form.roomCode} onChange={(e) => setForm((f) => ({ ...f, roomCode: e.target.value }))}
            className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-rust" />
        </div>
        <div>
          <label htmlFor="r-type" className="text-xs text-ink/50 block mb-1">Room type</label>
          <select id="r-type" value={form.roomType} onChange={(e) => setForm((f) => ({ ...f, roomType: e.target.value }))}
            className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-rust">
            <option>Single</option>
            <option>2-in-1</option>
            <option>3-in-1</option>
            <option>4-in-1</option>
          </select>
        </div>
        <div>
          <label htmlFor="r-price" className="sr-only">Price per year in Ghana cedis</label>
          <input id="r-price" required type="number" placeholder="Price per year (GHS)" value={form.pricePerYear}
            onChange={(e) => setForm((f) => ({ ...f, pricePerYear: e.target.value }))}
            className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-rust" />
        </div>
        <div>
          <label htmlFor="r-beds" className="sr-only">Number of beds</label>
          <input id="r-beds" required type="number" min="1" max="6" placeholder="Number of beds" value={form.bedCount}
            disabled={isEditing}
            aria-describedby={isEditing ? "r-beds-hint" : undefined}
            onChange={(e) => setForm((f) => ({ ...f, bedCount: e.target.value }))}
            className="w-full border border-ink/15 rounded-lg px-4 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-rust disabled:bg-ink/5 disabled:text-ink/40" />
          {isEditing && (
            <p id="r-beds-hint" className="text-xs text-ink/40 mt-1">
              Bed count can't be changed here — delete and recreate the room if you need a different number of beds.
            </p>
          )}
        </div>
        {amenityOptions.length > 0 && (
          <div className="max-h-40 overflow-y-auto border border-ink/10 rounded-lg p-3">
            <AmenityChips
              options={amenityOptions}
              selected={form.amenities}
              onToggle={toggleAmenity}
              label="Room amenities"
            />
          </div>
        )}
        {error && <p role="alert" className="text-rust text-sm">{error}</p>}
        <button type="submit" className="w-full bg-ink text-paper rounded-full py-2.5 font-medium hover:bg-rust outline-none focus-visible:ring-2 focus-visible:ring-rust">
          {isEditing ? "Save changes" : "Add room"}
        </button>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose }) {
  const containerRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const node = containerRef.current;
    const focusable = node.querySelectorAll(
      'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'
    );
    focusable[0]?.focus();

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    node.addEventListener("keydown", handleKeyDown);
    return () => node.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-paper rounded-2xl max-w-sm w-full p-6 border border-ink/10 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id={titleId} className="font-display text-xl text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-ink/40 hover:text-ink outline-none focus-visible:ring-2 focus-visible:ring-rust rounded p-1"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

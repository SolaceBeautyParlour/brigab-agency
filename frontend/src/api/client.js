const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getToken() {
  return sessionAuth.token;
}

// Persisted across page refreshes via localStorage. (Earlier in this
// project this was deliberately kept in-memory only, following the "no
// browser storage" rule for Claude.ai's sandboxed artifact preview — but
// Brigab Agency is a real, independently deployed site now, not an
// artifact, so that restriction doesn't apply here. Forcing a re-login on
// every refresh was a real usability bug, not a safety feature.)
const STORAGE_KEY = "brigab_auth";

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { token: null, user: null };
  } catch {
    return { token: null, user: null };
  }
}

function persistAuth(token, user) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private browsing, storage disabled) — auth
    // just won't survive a refresh in that case, same as before this fix.
  }
}

const stored = loadStoredAuth();
let _token = stored.token;
let _user = stored.user;

// Every existing `sessionAuth.token = x` / `sessionAuth.user = y` assignment
// in Login.jsx, Signup.jsx, and Header.jsx already works exactly as before —
// this just makes those assignments transparently persist too.
export const sessionAuth = {
  get token() { return _token; },
  set token(value) { _token = value; persistAuth(_token, _user); },
  get user() { return _user; },
  set user(value) { _user = value; persistAuth(_token, _user); },
};

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // This is the browser's raw "Failed to fetch" — it means the request
    // never even reached a server (no internet, DNS failure, server
    // completely down). That's a genuinely different situation from a
    // normal error response, and deserves a message a real person would
    // understand instead of what sounds like a code problem.
    throw new Error("Network issue — check your connection and try again.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Request failed");
    err.data = data; // callers that need more than the message (e.g. structured
    // details like an affected booking) can read err.data.
    throw err;
  }
  return data;
}

// Separate from request() on purpose: file uploads need FormData with no
// Content-Type set manually (the browser generates the multipart boundary
// itself) — JSON.stringify-ing a File would just break it.
async function uploadFile(path, file) {
  const formData = new FormData();
  formData.append("file", file);

  const headers = {};
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { method: "POST", headers, body: formData });
  } catch (err) {
    throw new Error("Network issue — check your connection and try again.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data;
}

export const api = {
  signup: (payload) => request("/auth/signup", { method: "POST", body: payload, auth: false }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload, auth: false }),

  browseHostels: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/hostels${qs ? `?${qs}` : ""}`, { auth: false });
  },
  getHostel: (id) => request(`/hostels/${id}`, { auth: false }),
  amenityOptions: () => request("/hostels/amenity-options", { auth: false }),

  holdBed: (bedId) => request("/bookings/hold", { method: "POST", body: { bedId } }),
  initializePayment: (payload) => request("/bookings/initialize-payment", { method: "POST", body: payload }),
  verifyPayment: (payload) => request("/payments/verify", { method: "POST", body: payload }),
  initializeBalancePayment: (bookingId) => request("/bookings/initialize-balance-payment", { method: "POST", body: { bookingId } }),
  verifyBalancePayment: (payload) => request("/payments/verify-balance", { method: "POST", body: payload }),
  myBookings: () => request("/bookings/mine"),

  joinWaitlist: (roomId) => request("/waitlist/join", { method: "POST", body: { roomId } }),
  waitlistForRoom: (roomId) => request(`/waitlist/room/${roomId}`),
  leaveWaitlist: (id) => request(`/waitlist/${id}`, { method: "DELETE" }),

  managerHostels: () => request("/manager/hostels"),
  createHostel: (payload) => request("/manager/hostels", { method: "POST", body: payload }),
  geocodeSearch: (q) => request(`/manager/geocode-search?q=${encodeURIComponent(q)}`),
  updateHostelLocation: (hostelId, latitude, longitude) =>
    request(`/manager/hostels/${hostelId}/location`, { method: "PATCH", body: { latitude, longitude } }),
  deleteHostel: (hostelId) => request(`/manager/hostels/${hostelId}`, { method: "DELETE" }),
  connectPaystack: (hostelId, payload) => request(`/manager/hostels/${hostelId}/connect-paystack`, { method: "POST", body: payload }),
  listBanks: () => request("/manager/banks"),
  createRoom: (hostelId, payload) => request(`/manager/hostels/${hostelId}/rooms`, { method: "POST", body: payload }),
  editRoom: (roomId, payload) => request(`/manager/rooms/${roomId}`, { method: "PATCH", body: payload }),
  deleteRoom: (roomId) => request(`/manager/rooms/${roomId}`, { method: "DELETE" }),
  uploadRoomMedia: (roomId, file) => uploadFile(`/manager/rooms/${roomId}/media`, file),
  uploadHostelMedia: (hostelId, file) => uploadFile(`/manager/hostels/${hostelId}/media`, file),
  deleteMedia: (mediaId) => request(`/manager/media/${mediaId}`, { method: "DELETE" }),
  toggleBed: (bedId, status, confirmOverride) => request(`/manager/beds/${bedId}`, { method: "PATCH", body: { status, confirmOverride } }),
  managerBookings: (hostelId) => request(`/manager/hostels/${hostelId}/bookings`),
};

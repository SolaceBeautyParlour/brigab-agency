const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function getToken() {
  return sessionAuth.token;
}

// In-memory auth store. Deliberately NOT localStorage (per artifact/browser
// storage constraints) — for a real deployed site, swapping this for an
// httpOnly cookie set by the backend is the recommended production pattern.
export const sessionAuth = { token: null, user: null };

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && getToken()) headers.Authorization = `Bearer ${getToken()}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

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

  const res = await fetch(`${BASE_URL}${path}`, { method: "POST", headers, body: formData });
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
  payBalance: (payload) => request("/payments/pay-balance", { method: "POST", body: payload }),
  myBookings: () => request("/bookings/mine"),

  joinWaitlist: (roomId) => request("/waitlist/join", { method: "POST", body: { roomId } }),
  waitlistForRoom: (roomId) => request(`/waitlist/room/${roomId}`),
  leaveWaitlist: (id) => request(`/waitlist/${id}`, { method: "DELETE" }),

  managerHostels: () => request("/manager/hostels"),
  createHostel: (payload) => request("/manager/hostels", { method: "POST", body: payload }),
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

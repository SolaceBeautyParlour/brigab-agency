// Single source of truth for both amenity checklists. Fixed lists (not
// free-text tags) so student filtering is actually reliable — "WiFi" and
// "Wi-Fi" typed by two different managers would never match each other.

// Property-wide — set once per hostel, applies to every room in it.
export const HOSTEL_AMENITIES = [
  "Free Water",
  "Security",
  "WiFi Services",
  "Generators/Plants",
  "Dry Lines",
  "Water Heater",
  "Swimming Pool",
  "Basketball Court",
  "Gym",
  "Game/TV Room",
  "CCTV Camera",
  "Salon",
  "Restaurant",
  "Laundry",
  "Football Pitch",
  "Hostel Shuttle",
  "Eatery",
  "Washing Machine",
  "Fenced Wall",
];

// Per-room — set on each individual room. Deliberately excludes property-wide
// items like Basketball Court/Gym, per how this was scoped.
export const ROOM_AMENITIES = [
  "Private Bathroom",
  "Shared Bathroom",
  "Shared Kitchen",
  "Wardrobe",
  "Balcony/Kitchen",
  "Table & Chair",
  "AC",
  "Fridge",
  "Study Desk",
  "Bunk Beds",
  "Single Beds",
  "Television",
  "Gas Cooker",
];

/** Strips out anything not on the approved list — never trust client input here. */
export function sanitizeAmenities(input, allowedList) {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(allowedList);
  return [...new Set(input.filter((item) => allowed.has(item)))];
}

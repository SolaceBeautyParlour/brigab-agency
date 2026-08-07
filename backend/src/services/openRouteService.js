const ORS_BASE = "https://api.openrouteservice.org";
const API_KEY = process.env.ORS_API_KEY;

/**
 * Resolves a place name/address to coordinates. Used both for the manager's
 * live address search while placing a pin, and for one-time-ever geocoding
 * of KNUST's fixed landmarks.
 */
export async function geocode(text) {
  if (!API_KEY) throw new Error("Location search isn't configured yet.");

  let res;
  try {
    res = await fetch(`${ORS_BASE}/geocode/search?api_key=${API_KEY}&text=${encodeURIComponent(text)}&size=5`);
  } catch (err) {
    throw new Error("Couldn't reach the location search service. Please try again.");
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Location search returned an unexpected response.");
  }

  if (!res.ok) {
    throw new Error(data.error?.message || "Location search failed.");
  }

  return (data.features || []).map((f) => ({
    label: f.properties.label,
    latitude: f.geometry.coordinates[1],
    longitude: f.geometry.coordinates[0],
  }));
}

/**
 * Real pedestrian-aware walking distance/duration between two points —
 * NOT the free public OSRM demo server, which (confirmed directly from its
 * own maintainers) silently returns driving routes no matter what profile
 * you ask for. This is the one that actually walks along footpaths.
 */
export async function getWalkingDistance(fromLat, fromLng, toLat, toLng) {
  if (!API_KEY) throw new Error("Walking distance isn't configured yet.");

  let res;
  try {
    res = await fetch(
      `${ORS_BASE}/v2/directions/foot-walking?api_key=${API_KEY}&start=${fromLng},${fromLat}&end=${toLng},${toLat}`
    );
  } catch (err) {
    throw new Error("Couldn't reach the routing service. Please try again.");
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Routing service returned an unexpected response.");
  }

  if (!res.ok || !data.features?.length) {
    throw new Error(data.error?.message || "Couldn't calculate a walking route between these points.");
  }

  const summary = data.features[0].properties.summary;
  return {
    meters: Math.round(summary.distance),
    minutes: Math.round(summary.duration / 60),
  };
}

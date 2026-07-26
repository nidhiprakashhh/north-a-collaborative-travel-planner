interface Coordinates {
  lat: number;
  lon: number;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
// Nominatim's usage policy caps unauthenticated use at 1 request/second and
// requires a descriptive User-Agent identifying the application.
const MIN_REQUEST_INTERVAL_MS = 1100;
const USER_AGENT =
  'North-TravelPlanner/1.0 (+https://github.com/nidhiprakashhh/north-a-collaborative-travel-planner)';
const REQUEST_TIMEOUT_MS = 5000;

// Module-level: persists for the process lifetime, shared across requests —
// a destination that's already been geocoded once (e.g. "Tokyo" on some
// other trip) never re-hits the API.
const geocodeCache = new Map<string, Coordinates | null>();
let lastRequestAt = 0;

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestAt = Date.now();
}

async function geocode(name: string): Promise<Coordinates | null> {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key)!;
  }

  await throttle();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
    if (!res.ok) {
      geocodeCache.set(key, null);
      return null;
    }
    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    const coords = results[0] ? { lat: Number(results[0].lat), lon: Number(results[0].lon) } : null;
    geocodeCache.set(key, coords);
    return coords;
  } catch (err) {
    console.warn(`[geocoding] failed to geocode "${name}"`, err);
    geocodeCache.set(key, null);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Nearest-neighbor heuristic: starting from the first point, repeatedly
// visit whichever remaining point is closest. Not guaranteed globally
// optimal (true route optimization is NP-hard TSP), but for the handful of
// destinations a trip like this ever has, it reliably eliminates the
// obvious backtracking that was the actual problem — not route perfection.
function nearestNeighborOrder<T extends Coordinates>(points: T[]): T[] {
  if (points.length <= 2) return points;

  const remaining = [...points];
  const route = [remaining.shift()!];

  while (remaining.length > 0) {
    const last = route[route.length - 1];
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const distance = haversineDistanceKm(last, remaining[i]);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }
    route.push(remaining.splice(nearestIndex, 1)[0]);
  }

  return route;
}

// Geocodes every candidate destination, drops any that couldn't be resolved
// (a geocoding miss shouldn't fail synthesis), and returns the rest in
// nearest-neighbor order. Returns null if fewer than 2 destinations resolve,
// since there's nothing meaningful to order.
export async function orderDestinationsGeographically(destinations: string[]): Promise<string[] | null> {
  const unique = Array.from(new Set(destinations.map((d) => d.trim()).filter(Boolean)));
  if (unique.length < 2) return null;

  const geocoded: Array<{ name: string; lat: number; lon: number }> = [];
  for (const name of unique) {
    const coords = await geocode(name);
    if (coords) {
      geocoded.push({ name, ...coords });
    }
  }

  if (geocoded.length < 2) return null;

  return nearestNeighborOrder(geocoded).map((p) => p.name);
}

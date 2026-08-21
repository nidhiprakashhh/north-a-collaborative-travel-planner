import { DestinationKnowledge } from '../models/DestinationKnowledge';

const WIKIVOYAGE_API = 'https://en.wikivoyage.org/w/api.php';
// Wikimedia's API doesn't publish a hard per-second cap the way Nominatim
// does, but a descriptive User-Agent identifying the application is expected
// regardless — same courtesy as geocodingService.ts's Nominatim calls.
const USER_AGENT =
  'North-TravelPlanner/1.0 (+https://github.com/nidhiprakashhh/north-a-collaborative-travel-planner)';
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days - travel guide content doesn't change fast

// Real named attractions/activities/food, not costs: Wikivoyage's "Budget"
// heading turned out (checked live) to be about accommodation price tiers
// under Sleep, not a general cost section, so cost grounding isn't a good
// fit for this source - that's left to the collaborative board redesign's
// real user-entered costs instead. This targets the failure this project
// actually hit: the LLM inventing/misplacing real landmarks.
const TARGET_SECTIONS = ['See', 'Do', 'Eat'];
const MAX_FACTS_LENGTH = 1500; // characters (~375 tokens) - keeps a multi-destination prompt section reasonable

interface WikivoyageSection {
  index: string;
  line: string;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[knowledge] request failed: ${url}`, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Not a full wikitext parser - just enough regex cleanup to make Wikivoyage's
// markup readable prose for an LLM prompt, not pixel-perfect rendering.
// Templates get stripped in two passes, which unwinds one level of nesting
// (inner braces first pass, outer second) - deeper nesting can leave stray
// braces behind, which is an acceptable rough edge for prompt context.
function stripWikitext(raw: string): string {
  return raw
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/\[https?:\/\/\S+\s+([^\]]+)\]/g, '$1')
    .replace(/\[https?:\/\/\S+\]/g, '')
    .replace(/'''?/g, '')
    .replace(/==+\s*([^=]+?)\s*==+/g, '$1:')
    .replace(/^\*+\s*/gm, '- ')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function findSectionIndex(name: string, target: string): Promise<string | null> {
  const url = `${WIKIVOYAGE_API}?action=parse&page=${encodeURIComponent(name)}&format=json&prop=sections`;
  const data = await fetchJson<{ parse?: { sections?: WikivoyageSection[] } }>(url);
  return data?.parse?.sections?.find((s) => s.line === target)?.index ?? null;
}

async function fetchSectionText(name: string, index: string): Promise<string | null> {
  const url = `${WIKIVOYAGE_API}?action=parse&page=${encodeURIComponent(name)}&format=json&prop=wikitext&section=${index}`;
  const data = await fetchJson<{ parse?: { wikitext?: { '*': string } } }>(url);
  const raw = data?.parse?.wikitext?.['*'];
  return raw ? stripWikitext(raw) : null;
}

// Section indices aren't fixed across pages (confirmed live - Kyoto's "See"
// is index 23, but a less-developed page might not have that section at
// all, or number it differently), so each target section is looked up by
// name against that specific page's own section list rather than assumed.
async function fetchFromWikivoyage(name: string): Promise<string | null> {
  // Per-section, not a global slice after joining - fetched wikitext for a
  // section already includes its own "== See ==" heading (which stripWikitext
  // turns into "See:"), so no separate prefix is added here; and truncating
  // each section individually means a long "See" can't silently eat the
  // whole budget and drop "Do"/"Eat" entirely, which a single slice(0, N)
  // on the joined text did in testing against real Kyoto/Tokyo pages.
  const perSectionBudget = Math.floor(MAX_FACTS_LENGTH / TARGET_SECTIONS.length);
  const parts: string[] = [];
  for (const section of TARGET_SECTIONS) {
    const index = await findSectionIndex(name, section);
    if (!index) continue;
    const text = await fetchSectionText(name, index);
    if (text) parts.push(text.slice(0, perSectionBudget));
  }
  if (parts.length === 0) {
    console.warn(`[knowledge] no usable Wikivoyage sections found for "${name}"`);
    return null;
  }
  return parts.join('\n');
}

// Cache-first (Mongo, not in-memory - this payload is real text worth
// surviving a process restart, unlike geocoding's lat/lon pairs). A
// destination fetched once, by any trip, is reused until CACHE_TTL_MS
// elapses. Returns null if Wikivoyage has no page (or nothing usable) for
// this name and there's no stale cache to fall back on - synthesis
// proceeds without grounding for that destination rather than failing
// outright, same fail-open philosophy as geocodingService.ts.
export async function getDestinationFacts(name: string): Promise<string | null> {
  const key = name.trim();
  if (!key) return null;

  const cached = await DestinationKnowledge.findOne({ name: key });
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    return cached.facts;
  }

  const facts = await fetchFromWikivoyage(key);
  if (!facts) {
    return cached?.facts ?? null;
  }

  await DestinationKnowledge.findOneAndUpdate(
    { name: key },
    { name: key, facts, source: 'wikivoyage', fetchedAt: new Date() },
    { upsert: true },
  );

  return facts;
}

import Groq from 'groq-sdk';
import { env } from '../config/env';
import { prisma } from '../db/postgres';
import { Preference } from '../models/Preference';
import { ItineraryVersion, IItineraryVersion, ConflictEntry } from '../models/ItineraryVersion';
import { computeVoteTallies } from './voteService';
import { orderDestinationsGeographically, geocode } from './geocodingService';
import { getDestinationFacts } from './knowledgeService';
import { getConsiderIdeas } from './considerService';
import { HttpError } from '../utils/httpError';

const groq = new Groq({ apiKey: env.groqApiKey });

interface MemberPromptData {
  userId: string;
  name: string;
  availableDates: string[];
  budgetPerDay: number;
  destinations: string[];
  activityTypes: string[];
  mustSee: string[];
  dealbreakers: string[];
}

// The model's numeric/array fields are typed loosely here (`unknown`) because
// despite prompting for a specific shape, LLM output is not guaranteed to
// match it exactly — the coerce* helpers below normalize it.
interface RawConflictEntry {
  description?: unknown;
  memberNames?: unknown;
}

interface RawSynthesisResult {
  days?: Array<{ destination?: string; activities?: unknown; accommodation?: string; cost?: unknown }>;
  totalBudget?: unknown;
  conflictsDetected?: unknown;
  consensusScore?: unknown;
  compromisesMade?: unknown;
}

export interface ItineraryDayPayload {
  destination: string;
  activities: string[];
  accommodation: string;
  cost: number;
}

export interface ItineraryPayload {
  tripId: string;
  version: number;
  days: ItineraryDayPayload[];
  totalBudget: number;
  conflictsDetected: ConflictEntry[];
  consensusScore: number;
  compromisesMade: string[];
  editedBy?: string;
  createdAt: Date;
}

// Inclusive of both endpoints (a trip from the 1st to the 3rd is 3 days, not
// 2) — matches how a traveler would actually count trip length.
const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function getExpectedDayCount(tripId: string): Promise<number | null> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { startDate: true, endDate: true },
  });
  if (!trip?.startDate || !trip?.endDate) {
    return null;
  }
  const days = Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / MS_PER_DAY) + 1;
  return days > 0 ? days : null;
}

async function gatherPromptData(
  tripId: string,
): Promise<{ members: MemberPromptData[]; topDestinations: string; expectedDayCount: number | null }> {
  const preferences = await Preference.find({ tripId });

  if (preferences.length === 0) {
    throw new HttpError(400, 'No preferences submitted for this trip yet');
  }

  const users = await prisma.user.findMany({
    where: { id: { in: preferences.map((p) => p.userId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const members: MemberPromptData[] = preferences.map((p) => ({
    userId: p.userId,
    name: nameById.get(p.userId) ?? 'Unknown',
    availableDates: p.availableDates,
    budgetPerDay: p.budgetPerDay,
    destinations: p.destinations,
    activityTypes: p.activityTypes,
    mustSee: p.mustSee,
    dealbreakers: p.dealbreakers,
  }));

  const tallies = await computeVoteTallies(tripId);
  const topDestinations =
    Object.entries(tallies)
      .sort((a, b) => b[1] - a[1])
      .map(([destination, votes]) => `${destination}: ${votes} vote(s)`)
      .join('\n') || 'No votes cast yet';

  const expectedDayCount = await getExpectedDayCount(tripId);

  return { members, topDestinations, expectedDayCount };
}

function averageBudgetPerDay(members: MemberPromptData[]): number {
  return members.reduce((sum, m) => sum + m.budgetPerDay, 0) / members.length;
}

function buildPrompt(
  members: MemberPromptData[],
  topDestinations: string,
  expectedDayCount: number | null,
  orderedDestinations: string[] | null,
  destinationFacts: Map<string, string>,
  considerList: string,
  currentDraft: string | null,
): string {
  const avgBudget = averageBudgetPerDay(members);
  const multiMember = members.length > 1;

  const factsSection =
    destinationFacts.size > 0
      ? `\nREAL DESTINATION FACTS (from a real travel guide — ground named places in these, don't invent competing ones for a destination that already has real facts listed):\n${Array.from(
          destinationFacts.entries(),
        )
          .map(([name, facts]) => `[${name}]\n${facts}`)
          .join('\n\n')}\n`
      : '';

  return `
You are a travel planning assistant. Generate a detailed trip itinerary.

GROUP PREFERENCES:
${members
    .map(
      (m) => `
  ${m.name}:
  - Available dates: ${m.availableDates.join(', ') || 'none specified'}
  - Budget per day: $${m.budgetPerDay}
  - Destinations wanted: ${m.destinations.join(', ') || 'none specified'}
  - Activities: ${m.activityTypes.join(', ') || 'none specified'}
  - Must see: ${m.mustSee.join(', ') || 'none specified'}
  - Dealbreakers: ${m.dealbreakers.join(', ') || 'none specified'}
`,
    )
    .join('\n')}

VOTING RESULTS:
${topDestinations}
${factsSection}
${considerList ? `\nIDEAS THE GROUP IS CONSIDERING (not requirements, just things people found worth sharing):\n${considerList}\n` : ''}
${currentDraft ? `\nCURRENT DRAFT (the group's existing itinerary — see constraint 10):\n${currentDraft}\n` : ''}

HARD CONSTRAINTS — follow these exactly, they are checked after you respond:
1. Each day's "cost" and the overall "totalBudget" must stay close to the group's average stated daily budget of $${avgBudget.toFixed(0)} (averaged across ${members.length} member(s)). Do not invent costs far above this — you have no real pricing data, so anchor everything to the stated budget instead of guessing.
2. Every "Must see" item listed by any member must appear in some day's "activities". If it is truly impossible to include given the dates/destinations, do NOT silently omit it — instead add an entry to "conflictsDetected" explaining why, attributed to that member's exact name.
3. IDEAS THE GROUP IS CONSIDERING are NOT must-see — use any that reasonably fit, but you may leave any or all of them out with no explanation and no "conflictsDetected" entry. Omitting one of these is never a conflict. Each is tagged [CONFIRMED REAL PLACE] (a verified real location — safe to use directly) or [unconfirmed] (no verified location — if you use it, keep it general; do NOT invent specific details like exact activities, ambiance, or a "type" of experience that wasn't actually given to you).
4. ${
    multiMember
      ? `There are ${members.length} members with potentially differing preferences — "compromisesMade" should explain real trade-offs you made between their specific stated preferences.`
      : 'There is only ONE member on this trip. "compromisesMade" MUST be an empty array — there is no one else to compromise with, so do not invent trade-offs.'
  }
5. Every entry in "conflictsDetected" must be an object of the exact shape {"description": "...", "memberNames": ["<exact name from GROUP PREFERENCES above>"]} — never a bare string, and never a name that isn't listed above.
6. Every day's "activities" array must contain 3 to 5 specific, distinct activities — never just one. Mix concrete sightseeing (named landmarks, not generic phrases like "sightseeing"), food, and at least one lower-key/downtime activity per day.
${
    expectedDayCount
      ? `7. The trip's dates give it an exact length of ${expectedDayCount} day(s) — the "days" array must contain exactly ${expectedDayCount} entries. Do not invent a different trip length.`
      : `7. No trip dates were set, so you may choose a reasonable trip length yourself — but do not claim or imply a specific number of days was constrained by "limited time" anywhere in your response, since no date range was actually given.`
  }
${
    orderedDestinations && orderedDestinations.length > 1
      ? `8. If the itinerary includes more than one of these destinations, they MUST appear in this exact sequence, since it's already the geographically shortest route between them (nearest-neighbor ordering by real coordinates) — do not reorder them, and do not backtrack to an earlier destination on a later day: ${orderedDestinations.join(' → ')}`
      : ''
  }
${
    destinationFacts.size > 0
      ? `9. REAL DESTINATION FACTS above are from an actual travel guide, not your own memory — prefer those specific named attractions/activities over inventing alternatives for any destination they cover.`
      : ''
  }
${
    currentDraft
      ? `10. A CURRENT DRAFT is provided above — this is a REVISION of the group's existing plan, not a first draft. Keep days, activities, accommodation, and costs that still fit everything else in this prompt; do not reshuffle, rewrite, or swap out things that are still working just for variety. But this cuts both ways: this is not permission to leave the draft untouched by default. If anything in this prompt is not yet reflected in the current draft — a new consider-idea, an updated preference, a new must-see, a changed budget — actually incorporate it where it reasonably fits, even if nothing forces you to. If the current draft conflicts with anything else in this prompt, the rest of this prompt wins — update the draft to match, don't preserve stale details just because they were there before.`
      : ''
  }

Return a JSON object with:
- days: array of day objects with destination, activities (array of 3-5 strings, see constraint 6), accommodation, cost (a single number in USD, not broken down by member name)
- totalBudget: a single number (see constraint 1)
- conflictsDetected: array of {description, memberNames} objects (see constraint 5)
- consensusScore: a single number 0-100 how well this satisfies all members
- compromisesMade: array of strings (see constraint 4)

Respond with valid JSON only. Every numeric field must be a plain number, never an object broken down by person.`;
}

// Groq's JSON mode usually returns clean JSON, but this strips a ```json
// fence defensively in case the model wraps its answer in a code block anyway.
function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1].trim() : trimmed);
}

// Despite the prompt asking for a plain number, the model sometimes returns
// a per-member breakdown object (e.g. { Alice: 150, Bob: 100 }) instead —
// this averages such an object into a single number rather than crashing
// Mongoose's Number cast.
function coerceNumber(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'string' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  if (value && typeof value === 'object') {
    const nums = Object.values(value as Record<string, unknown>).filter(
      (v): v is number => typeof v === 'number' && !Number.isNaN(v),
    );
    if (nums.length > 0) {
      return nums.reduce((sum, n) => sum + n, 0) / nums.length;
    }
  }
  return 0;
}

// Rare but observed live: the model occasionally leaks fragments of the
// JSON schema itself into an array of otherwise-legitimate strings — e.g.
// "activities" ending up with trailing elements like "]", ":", or literally
// "accommodation"/"cost" (the field names right after it in the schema),
// as if it lost track of where the array should have closed. Filters out
// only things that could never be a real activity/name/compromise anyway
// (pure punctuation, or an exact match to a JSON field name from this
// schema) — never touches legitimate content.
const SCHEMA_LEAK_TOKENS = new Set([
  'accommodation',
  'cost',
  'activities',
  'destination',
  'days',
  'totalbudget',
  'conflictsdetected',
  'consensusscore',
  'compromisesmade',
  'description',
  'membernames',
]);

function isSchemaLeak(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^[[\]{}:,]+$/.test(trimmed)) return true;
  // A bare ":150" or ": 150" - a leaked "cost": 150 fragment with the key
  // stripped off elsewhere in the same leak. No legitimate activity is ever
  // just a colon and a number.
  if (/^:\s*\d+(\.\d+)?$/.test(trimmed)) return true;
  return SCHEMA_LEAK_TOKENS.has(trimmed.toLowerCase());
}

// Exported for direct unit testing, same reasoning as fuzzyIncludes below -
// this is normalizing a real, observed live failure mode, not a
// hypothetical one.
export function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).filter((v) => !isSchemaLeak(v));
  }
  if (typeof value === 'string') {
    return isSchemaLeak(value) ? [] : [value];
  }
  return [];
}

// The model is asked to name members exactly, but treat that loosely
// (case/whitespace-insensitive) rather than dropping a conflict entirely
// over a formatting mismatch.
function coerceConflicts(value: unknown, nameToUserId: Map<string, string>): ConflictEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry): ConflictEntry => {
    if (typeof entry === 'string') {
      // Model ignored the structured format — keep the text, no attribution.
      return { description: entry, memberIds: [] };
    }
    const raw = entry as RawConflictEntry;
    const description = typeof raw.description === 'string' ? raw.description : JSON.stringify(entry);
    const names = coerceStringArray(raw.memberNames);
    const memberIds = names
      .map((name) => nameToUserId.get(name.trim().toLowerCase()))
      .filter((id): id is string => Boolean(id));
    return { description, memberIds };
  });
}

function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

// Checks whether every word in `needleWords` appears, in order, within
// `windowWords` — skipping over extra words in between — allowing each
// individual word a small typo tolerance rather than comparing the whole
// phrase as one string.
function needleWordsAppearInOrder(needleWords: string[], windowWords: string[]): boolean {
  let windowIndex = 0;
  for (const needleWord of needleWords) {
    let found = false;
    while (windowIndex < windowWords.length) {
      const candidate = windowWords[windowIndex];
      windowIndex++;
      const maxCharDistance = Math.max(1, Math.ceil(needleWord.length * 0.3));
      if (levenshteinDistance(candidate, needleWord) <= maxCharDistance) {
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

// A plain `.includes()` check produces false-positive conflicts in two real
// cases seen in production: a typo in what a member typed (e.g. "Fushimi
// Inikari" vs the model's correctly-spelled "Fushimi Inari"), and the model
// inserting an extra, correct qualifier word (e.g. member wrote "teamLab
// digital art museum", model wrote "teamLab Borderless digital art
// museum" — Borderless being the real exhibit name). A fixed-word-count
// sliding window catches the first but not the second, since no window the
// same length as the needle aligns closely enough once a word is inserted —
// this instead allows up to 3 extra words within the matched span, and
// fuzzy-matches word-by-word rather than the whole phrase as one string.
// Exported for direct unit testing — this function has caught two real
// production bugs already (a typo, and a model-inserted qualifier word),
// which is a strong enough signal to pin its behavior down with tests
// rather than only exercising it indirectly through a full synthesis run.
export function fuzzyIncludes(haystack: string, needle: string): boolean {
  if (!needle) return false;
  if (haystack.includes(needle)) return true;

  const haystackWords = haystack.split(/\s+/).filter(Boolean);
  const needleWords = needle.split(/\s+/).filter(Boolean);
  if (needleWords.length === 0) return false;

  const maxWindow = needleWords.length + 3;

  for (let start = 0; start <= haystackWords.length - needleWords.length; start++) {
    const window = haystackWords.slice(start, start + maxWindow);
    if (needleWordsAppearInOrder(needleWords, window)) return true;
  }
  return false;
}

// Deterministic checks that don't rely on the model having followed the
// prompt's constraints — small models often don't. These run after parsing
// and augment (never remove) the model's own output.
function applyGuardrails(
  draft: {
    days: ItineraryDayPayload[];
    totalBudget: number;
    conflictsDetected: ConflictEntry[];
    compromisesMade: string[];
  },
  members: MemberPromptData[],
  expectedDayCount: number | null,
): void {
  const avgBudget = averageBudgetPerDay(members);
  const dayCount = draft.days.length || 1;
  const expectedCeiling = avgBudget * dayCount * 1.5; // 50% margin for legitimate variation

  if (draft.totalBudget > expectedCeiling) {
    draft.conflictsDetected.push({
      description: `The synthesized total budget ($${draft.totalBudget.toFixed(0)}) significantly exceeds the group's stated daily budgets (average $${avgBudget.toFixed(0)}/day across ${dayCount} day(s)). Consider regenerating.`,
      memberIds: members.map((m) => m.userId),
    });
  }

  // The prompt states the exact day count when the trip has real dates —
  // small models sometimes ignore it anyway, so this catches (rather than
  // silently accepts) a mismatch instead of trusting it was followed.
  if (expectedDayCount !== null && draft.days.length !== expectedDayCount) {
    draft.conflictsDetected.push({
      description: `The trip's dates specify ${expectedDayCount} day(s), but the generated itinerary has ${draft.days.length}. Consider regenerating.`,
      memberIds: members.map((m) => m.userId),
    });
  }

  const activityText = draft.days
    .map((d) => `${d.destination} ${d.activities.join(' ')}`)
    .join(' ')
    .toLowerCase();
  const explainedText = draft.conflictsDetected.map((c) => c.description).join(' ').toLowerCase();

  for (const member of members) {
    for (const item of member.mustSee) {
      const itemLower = item.trim().toLowerCase();
      if (!itemLower) continue;
      const covered = fuzzyIncludes(activityText, itemLower);
      const alreadyExplained = fuzzyIncludes(explainedText, itemLower);
      if (!covered && !alreadyExplained) {
        draft.conflictsDetected.push({
          description: `"${item}" was listed as a must-see by ${member.name} but does not appear anywhere in the itinerary, and no explanation was given.`,
          memberIds: [member.userId],
        });
      }
    }
  }

  // Even if the prompt was ignored, a solo trip has no one to "compromise" with.
  if (members.length <= 1) {
    draft.compromisesMade = [];
  }
}

function toPayload(doc: IItineraryVersion): ItineraryPayload {
  return {
    tripId: doc.tripId,
    version: doc.version,
    days: doc.days,
    totalBudget: doc.totalBudget,
    conflictsDetected: doc.conflictsDetected,
    consensusScore: doc.consensusScore,
    compromisesMade: doc.compromisesMade,
    editedBy: doc.editedBy,
    createdAt: doc.createdAt,
  };
}

const MAX_GENERATION_ATTEMPTS = 3;

// A small (8B) model doing structured JSON generation occasionally produces
// invalid JSON outright (e.g. writing "150 * 9 = 1350" as a value instead of
// the number) — Groq's json_object mode catches this itself and returns a
// 400 rather than passing broken JSON through, but it's still a transient
// generation failure worth retrying rather than failing the whole request.
async function requestSynthesis(prompt: string): Promise<RawSynthesisResult> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
        model: env.groqModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('LLM returned an empty response');
      }

      return extractJson(content) as RawSynthesisResult;
    } catch (err) {
      lastError = err;
      console.warn(`[synthesis] generation attempt ${attempt}/${MAX_GENERATION_ATTEMPTS} failed`, err);
    }
  }

  throw new HttpError(
    502,
    `LLM failed to produce a valid itinerary after ${MAX_GENERATION_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : 'unknown error'
    }`,
  );
}

// Real facts (not the model's own memory) for each destination, from a real
// travel guide — see knowledgeService.ts. A destination that fails to
// resolve (network issue, no Wikivoyage page) is just left out of the map
// rather than blocking synthesis, same fail-open pattern as geocoding below.
async function gatherDestinationFacts(destinations: string[]): Promise<Map<string, string>> {
  const facts = new Map<string, string>();
  for (const destination of destinations) {
    try {
      const result = await getDestinationFacts(destination);
      if (result) facts.set(destination, result);
    } catch (err) {
      console.warn(`[synthesis] failed to fetch destination facts for "${destination}"`, err);
    }
  }
  return facts;
}

// The shared consider-list is trip-wide, not per-member (see ConsiderIdea.ts)
// — formatted here rather than folded into a member's data, since it isn't
// any one person's preference. Resolves addedBy separately from
// gatherPromptData's own user lookup because an idea's author might not
// have submitted preferences at all.
const CONSIDER_IDEA_URL_PATTERN = /https?:\/\/\S+/g;

// Attempts to verify each idea against a real place (reusing the same
// Nominatim geocoding used for destination ordering) and tags it
// accordingly, rather than passing the group's raw text through unlabeled.
// Sequential, not Promise.all — see the warning on geocode() itself about
// why concurrent calls aren't safe with its rate limiter.
async function gatherConsiderList(tripId: string): Promise<string> {
  const ideas = await getConsiderIdeas(tripId);
  if (ideas.length === 0) return '';

  const users = await prisma.user.findMany({
    where: { id: { in: ideas.map((i) => i.addedBy) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const lines: string[] = [];
  for (const idea of ideas) {
    const attribution = `added by ${nameById.get(idea.addedBy) ?? 'someone'}`;

    // A URL in the text (e.g. "Ichiran Ramen - https://ichiran.com") isn't
    // part of the place name — strip it before querying, since feeding a
    // raw URL to a geocoder is meaningless and would just waste the request.
    const queryText = idea.name.replace(CONSIDER_IDEA_URL_PATTERN, '').replace(/[-–—]+$/, '').trim();

    const coords = queryText
      ? await geocode(queryText).catch((err) => {
          console.warn(`[synthesis] failed to verify consider-idea "${idea.name}"`, err);
          return null;
        })
      : null;

    const status = coords
      ? 'CONFIRMED REAL PLACE — use it directly, no need to guess details'
      : 'unconfirmed — no verified location; use the general idea if it fits, do not invent specific details for it';

    lines.push(`- ${idea.name} (${attribution}) [${status}]`);
  }

  return lines.join('\n');
}

// The single most-recent itinerary, formatted as prompt context so
// "Regenerate" revises the group's existing plan instead of discarding it
// and generating a fresh one from scratch every time (which is what
// happened before this — every regenerate was a full reroll, even when
// only one small thing changed since the last run). Returns null on a
// trip's first-ever synthesis, when there's nothing yet to revise.
async function formatCurrentDraft(tripId: string): Promise<string | null> {
  const latest = await ItineraryVersion.findOne({ tripId }).sort({ version: -1 });
  if (!latest) return null;

  const days = latest.days
    .map((d, i) => `Day ${i + 1} (${d.destination}): ${d.activities.join(', ')} — ${d.accommodation}, $${d.cost}`)
    .join('\n');

  return `Version ${latest.version}, total budget $${latest.totalBudget}, consensus score ${latest.consensusScore}/100:\n${days}`;
}

export async function synthesizeItinerary(tripId: string): Promise<ItineraryPayload> {
  const { members, topDestinations, expectedDayCount } = await gatherPromptData(tripId);

  // The LLM has no real notion of geography, so route ordering is computed
  // here from real coordinates rather than left to the model — see
  // geocodingService.ts. A geocoding failure (network issue, unresolvable
  // name) degrades to `null` rather than blocking synthesis.
  const allDestinations = Array.from(new Set(members.flatMap((m) => m.destinations)));
  const orderedDestinations = await orderDestinationsGeographically(allDestinations).catch((err) => {
    console.warn('[synthesis] geographic ordering failed, continuing without it', err);
    return null;
  });
  const destinationFacts = await gatherDestinationFacts(allDestinations);
  const considerList = await gatherConsiderList(tripId).catch((err) => {
    console.warn('[synthesis] failed to gather consider list, continuing without it', err);
    return '';
  });
  const currentDraft = await formatCurrentDraft(tripId).catch((err) => {
    console.warn('[synthesis] failed to load current draft, generating fresh instead', err);
    return null;
  });

  const prompt = buildPrompt(
    members,
    topDestinations,
    expectedDayCount,
    orderedDestinations,
    destinationFacts,
    considerList,
    currentDraft,
  );

  const parsed = await requestSynthesis(prompt);

  const nameToUserId = new Map(members.map((m) => [m.name.trim().toLowerCase(), m.userId]));

  const draft = {
    days: (parsed.days ?? []).map((d) => ({
      destination: d.destination ?? '',
      activities: coerceStringArray(d.activities),
      accommodation: d.accommodation ?? '',
      cost: coerceNumber(d.cost),
    })),
    totalBudget: coerceNumber(parsed.totalBudget),
    conflictsDetected: coerceConflicts(parsed.conflictsDetected, nameToUserId),
    consensusScore: coerceNumber(parsed.consensusScore),
    compromisesMade: coerceStringArray(parsed.compromisesMade),
  };

  applyGuardrails(draft, members, expectedDayCount);

  const latest = await ItineraryVersion.findOne({ tripId }).sort({ version: -1 });
  const nextVersion = (latest?.version ?? 0) + 1;

  const itinerary = await ItineraryVersion.create({
    tripId,
    version: nextVersion,
    ...draft,
  });

  return toPayload(itinerary);
}

// Used for initial page load — the socket layer only broadcasts
// itinerary_updated on new synthesis runs, not the existing latest version.
export async function getLatestItinerary(tripId: string): Promise<ItineraryPayload | null> {
  const latest = await ItineraryVersion.findOne({ tripId }).sort({ version: -1 });
  return latest ? toPayload(latest) : null;
}

export interface ItineraryDayEdit {
  activities?: string[];
  accommodation?: string;
  cost?: number;
}

// A manual edit to one day of the current itinerary — creates a new version
// (same append-only history as an LLM synthesis run) with just that day's
// fields changed and everything else carried over unchanged. Deliberately
// tagged with editedBy but otherwise treated identically to an LLM version:
// the next Regenerate's "current draft" read (see formatCurrentDraft) just
// picks up whatever the latest version is, source-agnostic, so a manual
// edit gets the same revise-not-reroll protection any other stable part of
// the plan already gets.
export async function editItineraryDay(
  tripId: string,
  userId: string,
  dayIndex: number,
  updates: ItineraryDayEdit,
): Promise<ItineraryPayload> {
  const latest = await ItineraryVersion.findOne({ tripId }).sort({ version: -1 });
  if (!latest) {
    throw new HttpError(400, 'No itinerary exists yet for this trip — generate one before editing it');
  }
  if (dayIndex < 0 || dayIndex >= latest.days.length) {
    throw new HttpError(400, `Day ${dayIndex + 1} does not exist in the current itinerary`);
  }
  if (updates.activities === undefined && updates.accommodation === undefined && updates.cost === undefined) {
    throw new HttpError(400, 'Nothing to update — provide activities, accommodation, or cost');
  }

  const days = latest.days.map((day, i) =>
    i === dayIndex
      ? {
          destination: day.destination,
          activities: updates.activities ?? day.activities,
          accommodation: updates.accommodation ?? day.accommodation,
          cost: updates.cost ?? day.cost,
        }
      : day,
  );

  const edited = await ItineraryVersion.create({
    tripId,
    version: latest.version + 1,
    days,
    totalBudget: latest.totalBudget,
    conflictsDetected: latest.conflictsDetected,
    consensusScore: latest.consensusScore,
    compromisesMade: latest.compromisesMade,
    editedBy: userId,
  });

  return toPayload(edited);
}

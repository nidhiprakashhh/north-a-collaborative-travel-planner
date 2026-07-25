import Groq from 'groq-sdk';
import { env } from '../config/env';
import { prisma } from '../db/postgres';
import { Preference } from '../models/Preference';
import { ItineraryVersion, IItineraryVersion, ConflictEntry } from '../models/ItineraryVersion';
import { computeVoteTallies } from './voteService';
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
  createdAt: Date;
}

async function gatherPromptData(
  tripId: string,
): Promise<{ members: MemberPromptData[]; topDestinations: string }> {
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

  return { members, topDestinations };
}

function averageBudgetPerDay(members: MemberPromptData[]): number {
  return members.reduce((sum, m) => sum + m.budgetPerDay, 0) / members.length;
}

function buildPrompt(members: MemberPromptData[], topDestinations: string): string {
  const avgBudget = averageBudgetPerDay(members);
  const multiMember = members.length > 1;

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

HARD CONSTRAINTS — follow these exactly, they are checked after you respond:
1. Each day's "cost" and the overall "totalBudget" must stay close to the group's average stated daily budget of $${avgBudget.toFixed(0)} (averaged across ${members.length} member(s)). Do not invent costs far above this — you have no real pricing data, so anchor everything to the stated budget instead of guessing.
2. Every "Must see" item listed by any member must appear in some day's "activities". If it is truly impossible to include given the dates/destinations, do NOT silently omit it — instead add an entry to "conflictsDetected" explaining why, attributed to that member's exact name.
3. ${
    multiMember
      ? `There are ${members.length} members with potentially differing preferences — "compromisesMade" should explain real trade-offs you made between their specific stated preferences.`
      : 'There is only ONE member on this trip. "compromisesMade" MUST be an empty array — there is no one else to compromise with, so do not invent trade-offs.'
  }
4. Every entry in "conflictsDetected" must be an object of the exact shape {"description": "...", "memberNames": ["<exact name from GROUP PREFERENCES above>"]} — never a bare string, and never a name that isn't listed above.

Return a JSON object with:
- days: array of day objects with destination, activities (array of strings), accommodation, cost (a single number in USD, not broken down by member name)
- totalBudget: a single number (see constraint 1)
- conflictsDetected: array of {description, memberNames} objects (see constraint 4)
- consensusScore: a single number 0-100 how well this satisfies all members
- compromisesMade: array of strings (see constraint 3)

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

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v));
  }
  if (typeof value === 'string') {
    return [value];
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

  const activityText = draft.days
    .map((d) => `${d.destination} ${d.activities.join(' ')}`)
    .join(' ')
    .toLowerCase();
  const explainedText = draft.conflictsDetected.map((c) => c.description).join(' ').toLowerCase();

  for (const member of members) {
    for (const item of member.mustSee) {
      const itemLower = item.trim().toLowerCase();
      if (!itemLower) continue;
      const covered = activityText.includes(itemLower);
      const alreadyExplained = explainedText.includes(itemLower);
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

export async function synthesizeItinerary(tripId: string): Promise<ItineraryPayload> {
  const { members, topDestinations } = await gatherPromptData(tripId);
  const prompt = buildPrompt(members, topDestinations);

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

  applyGuardrails(draft, members);

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

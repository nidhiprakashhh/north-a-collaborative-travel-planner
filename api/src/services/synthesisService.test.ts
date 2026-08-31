import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  fuzzyIncludes,
  coerceStringArray,
  coerceNumber,
  coerceConflicts,
  extractJson,
  applyGuardrails,
  buildPrompt,
  formatCurrentDraft,
  editItineraryDay,
  MemberPromptData,
} from './synthesisService';
import { ItineraryVersion } from '../models/ItineraryVersion';
import { HttpError } from '../utils/httpError';
import { resetDatabase, connectTestMongo, disconnectTestMongo } from '../test/setup';

// Shared fixture builder so each test only states the fields it actually
// cares about, matching this file's existing style.
function member(overrides: Partial<MemberPromptData> = {}): MemberPromptData {
  return {
    userId: 'user-1',
    name: 'Alice',
    availableDates: [],
    budgetPerDay: 100,
    destinations: [],
    activityTypes: [],
    mustSee: [],
    dealbreakers: [],
    ...overrides,
  };
}

// Both cases here are real false-positive conflicts caught in production,
// not hypothetical edge cases.
describe('fuzzyIncludes', () => {
  it('matches an exact substring', () => {
    expect(fuzzyIncludes('visit fushimi inari taisha today', 'fushimi inari taisha')).toBe(true);
  });

  it('matches despite a typo in the needle (member mistyped their must-see)', () => {
    // Real case: member typed "Fushimi Inikari", model correctly wrote
    // "Fushimi Inari" - the guardrail must not flag this as missing.
    expect(fuzzyIncludes('day 1: visit fushimi inari taisha shrine', 'fushimi inikari')).toBe(true);
  });

  it('matches when the model inserts an extra, correct qualifier word', () => {
    // Real case: member typed "teamLab digital art museum", model wrote
    // "teamLab Borderless digital art museum" (Borderless is the real
    // exhibit name) - a fixed-word-count window can't tolerate the
    // inserted word, which is exactly the bug this test guards against.
    expect(
      fuzzyIncludes(
        'visit the teamlab borderless digital art museum in odaiba',
        'teamlab digital art museum',
      ),
    ).toBe(true);
  });

  it('does not match a genuinely different, unrelated phrase', () => {
    expect(fuzzyIncludes('visit tokyo tower and shibuya crossing', 'fushimi inari taisha')).toBe(false);
  });

  it('does not match when only some needle words are present', () => {
    expect(fuzzyIncludes('visit the modern art gallery downtown', 'teamlab digital art museum')).toBe(false);
  });

  it('returns false for an empty needle', () => {
    expect(fuzzyIncludes('anything at all', '')).toBe(false);
  });
});

describe('coerceStringArray', () => {
  it('passes through legitimate strings unchanged', () => {
    expect(coerceStringArray(['Visit Kinkaku-ji', 'Lunch at Ichiran Ramen'])).toEqual([
      'Visit Kinkaku-ji',
      'Lunch at Ichiran Ramen',
    ]);
  });

  it('strips JSON schema fragments the model leaked into the array', () => {
    // Real case, caught live: a day's "activities" array ended with
    // ["...", "]", "accommodation", ":", "Stay at a hotel", "cost", ":150"]
    // - the model lost track of where the array should have closed.
    expect(
      coerceStringArray([
        'Visit Kinkaku-ji',
        'Lunch at Ichiran Ramen',
        ']',
        'accommodation',
        ':',
        'Stay at a hotel',
        'cost',
        ':150',
      ]),
    ).toEqual(['Visit Kinkaku-ji', 'Lunch at Ichiran Ramen', 'Stay at a hotel']);
  });

  it('does not strip a real activity that merely mentions a schema word in context', () => {
    // "cost" appearing as a real, meaningful part of a sentence must survive
    // - only an exact, standalone match to a field name is treated as a leak.
    expect(coerceStringArray(['Budget-friendly food at low cost'])).toEqual(['Budget-friendly food at low cost']);
  });

  it('drops empty strings', () => {
    expect(coerceStringArray(['Visit Kinkaku-ji', '', '   '])).toEqual(['Visit Kinkaku-ji']);
  });

  it('wraps a single non-leak string', () => {
    expect(coerceStringArray('Visit Kinkaku-ji')).toEqual(['Visit Kinkaku-ji']);
  });

  it('returns empty array for a non-array, non-string value', () => {
    expect(coerceStringArray(undefined)).toEqual([]);
    expect(coerceStringArray(42)).toEqual([]);
  });
});

describe('coerceNumber', () => {
  it('passes through a plain number', () => {
    expect(coerceNumber(150)).toBe(150);
  });

  it('parses a numeric string', () => {
    expect(coerceNumber('150')).toBe(150);
  });

  it('averages a per-member cost breakdown object instead of crashing', () => {
    // Real shape seen from the model despite the prompt asking for a single
    // number: { Alice: 150, Bob: 100 } instead of a plain 125.
    expect(coerceNumber({ Alice: 150, Bob: 100 })).toBe(125);
  });

  it('returns 0 for an object with no numeric values', () => {
    expect(coerceNumber({ note: 'unknown' })).toBe(0);
  });

  it('returns 0 for garbage input', () => {
    expect(coerceNumber('not a number')).toBe(0);
    expect(coerceNumber(null)).toBe(0);
    expect(coerceNumber(undefined)).toBe(0);
    expect(coerceNumber(NaN)).toBe(0);
  });
});

describe('coerceConflicts', () => {
  const nameToUserId = new Map([
    ['alice', 'user-1'],
    ['bob', 'user-2'],
  ]);

  it('resolves memberNames to userIds via the name map', () => {
    expect(coerceConflicts([{ description: 'Budget too high', memberNames: ['Alice', 'Bob'] }], nameToUserId)).toEqual([
      { description: 'Budget too high', memberIds: ['user-1', 'user-2'] },
    ]);
  });

  it('resolves names case- and whitespace-insensitively', () => {
    expect(coerceConflicts([{ description: 'x', memberNames: [' ALICE ', 'bob'] }], nameToUserId)).toEqual([
      { description: 'x', memberIds: ['user-1', 'user-2'] },
    ]);
  });

  it('wraps a bare string entry with no attribution', () => {
    // The model ignored the structured {description, memberNames} format -
    // keep the text rather than dropping the conflict entirely.
    expect(coerceConflicts(['Something went wrong'], nameToUserId)).toEqual([
      { description: 'Something went wrong', memberIds: [] },
    ]);
  });

  it('drops unresolvable names but keeps the description', () => {
    expect(coerceConflicts([{ description: 'x', memberNames: ['Alice', 'Nobody'] }], nameToUserId)).toEqual([
      { description: 'x', memberIds: ['user-1'] },
    ]);
  });

  it('returns an empty array for non-array input', () => {
    expect(coerceConflicts(undefined, nameToUserId)).toEqual([]);
  });
});

describe('extractJson', () => {
  it('parses a plain JSON string', () => {
    expect(extractJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it('strips a ```json fence', () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('strips a plain ``` fence with no language tag', () => {
    expect(extractJson('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('throws on genuinely malformed JSON', () => {
    expect(() => extractJson('{a: 1')).toThrow();
  });
});

describe('applyGuardrails', () => {
  function draft(overrides: Partial<Parameters<typeof applyGuardrails>[0]> = {}) {
    return {
      days: [
        { destination: 'Paris', activities: ['Visit the Louvre'], accommodation: 'Hotel A', cost: 100 },
        { destination: 'Paris', activities: ['Eiffel Tower'], accommodation: 'Hotel A', cost: 100 },
      ],
      totalBudget: 200,
      conflictsDetected: [],
      compromisesMade: [],
      ...overrides,
    };
  }

  it('adds no conflict when the total budget is within the 50% margin', () => {
    const d = draft({ totalBudget: 250 }); // avg 100/day * 2 days * 1.5 = 300 ceiling
    applyGuardrails(d, [member({ budgetPerDay: 100 })], null);
    expect(d.conflictsDetected).toEqual([]);
  });

  it('flags a budget blowout beyond the 50% margin', () => {
    const d = draft({ totalBudget: 400 }); // > 300 ceiling
    applyGuardrails(d, [member({ userId: 'user-1', budgetPerDay: 100 })], null);
    expect(d.conflictsDetected).toHaveLength(1);
    expect(d.conflictsDetected[0].description).toContain('exceeds');
    expect(d.conflictsDetected[0].memberIds).toEqual(['user-1']);
  });

  it('flags a day-count mismatch against the trip\'s actual dates', () => {
    const d = draft(); // 2 days
    applyGuardrails(d, [member()], 3);
    expect(d.conflictsDetected.some((c) => c.description.includes('3 day') && c.description.includes('has 2'))).toBe(
      true,
    );
  });

  it('adds no day-count conflict when the count matches', () => {
    const d = draft(); // 2 days
    applyGuardrails(d, [member()], 2);
    expect(d.conflictsDetected).toEqual([]);
  });

  it('skips the day-count check entirely when no trip dates were set', () => {
    const d = draft(); // 2 days
    applyGuardrails(d, [member()], null);
    expect(d.conflictsDetected).toEqual([]);
  });

  it('flags an unfulfilled must-see with no explanation', () => {
    const d = draft();
    applyGuardrails(d, [member({ userId: 'user-1', name: 'Alice', mustSee: ['Notre Dame'] })], null);
    expect(d.conflictsDetected).toHaveLength(1);
    expect(d.conflictsDetected[0].description).toContain('Notre Dame');
    expect(d.conflictsDetected[0].memberIds).toEqual(['user-1']);
  });

  it('does not flag a must-see that actually appears in the itinerary', () => {
    const d = draft();
    applyGuardrails(d, [member({ mustSee: ['Eiffel Tower'] })], null);
    expect(d.conflictsDetected).toEqual([]);
  });

  it('does not double-flag a must-see the model already explained as a conflict', () => {
    const d = draft({
      conflictsDetected: [{ description: 'Notre Dame could not be fit into the schedule', memberIds: [] }],
    });
    applyGuardrails(d, [member({ mustSee: ['Notre Dame'] })], null);
    // Still just the one, model-provided conflict - the guardrail must not add a second.
    expect(d.conflictsDetected).toHaveLength(1);
  });

  it('forces compromisesMade to empty on a solo trip even if the model invented one', () => {
    const d = draft({ compromisesMade: ['Compromised with myself'] });
    applyGuardrails(d, [member()], null);
    expect(d.compromisesMade).toEqual([]);
  });

  it('leaves compromisesMade untouched for a multi-member trip', () => {
    const d = draft({ compromisesMade: ['Balanced food vs history'] });
    applyGuardrails(d, [member({ userId: 'user-1' }), member({ userId: 'user-2', name: 'Bob' })], null);
    expect(d.compromisesMade).toEqual(['Balanced food vs history']);
  });
});

describe('buildPrompt', () => {
  const noFacts = new Map<string, string>();

  it('tells the model there is no one to compromise with on a solo trip', () => {
    const prompt = buildPrompt([member()], 'none', null, null, noFacts, '', null);
    expect(prompt).toContain('only ONE member');
    expect(prompt).not.toContain('potentially differing preferences');
  });

  it('asks for real trade-offs between members on a multi-member trip', () => {
    const prompt = buildPrompt(
      [member({ userId: 'user-1' }), member({ userId: 'user-2', name: 'Bob' })],
      'none',
      null,
      null,
      noFacts,
      '',
      null,
    );
    expect(prompt).toContain('2 members with potentially differing preferences');
  });

  it('states the exact required day count when the trip has real dates', () => {
    const prompt = buildPrompt([member()], 'none', 5, null, noFacts, '', null);
    expect(prompt).toContain('exact length of 5 day(s)');
    expect(prompt).not.toContain('No trip dates were set');
  });

  it('allows the model to choose a length when no dates were set', () => {
    const prompt = buildPrompt([member()], 'none', null, null, noFacts, '', null);
    expect(prompt).toContain('No trip dates were set');
  });

  it('pins the geographic visiting order when more than one destination is ordered', () => {
    const prompt = buildPrompt([member()], 'none', null, ['Tokyo', 'Kyoto', 'Osaka'], noFacts, '', null);
    expect(prompt).toContain('Tokyo → Kyoto → Osaka');
  });

  it('omits the ordering constraint for a single destination', () => {
    const prompt = buildPrompt([member()], 'none', null, ['Tokyo'], noFacts, '', null);
    expect(prompt).not.toContain('MUST appear in this exact sequence');
  });

  it('omits the ordering constraint when no ordering was computed', () => {
    const prompt = buildPrompt([member()], 'none', null, null, noFacts, '', null);
    expect(prompt).not.toContain('MUST appear in this exact sequence');
  });

  it('includes real destination facts and tells the model to prefer them', () => {
    const facts = new Map([['Kyoto', 'Fushimi Inari is a famous shrine.']]);
    const prompt = buildPrompt([member()], 'none', null, null, facts, '', null);
    expect(prompt).toContain('REAL DESTINATION FACTS');
    expect(prompt).toContain('Fushimi Inari is a famous shrine.');
    expect(prompt).toContain('prefer those specific named attractions');
  });

  it('omits the facts section entirely when none were found', () => {
    const prompt = buildPrompt([member()], 'none', null, null, noFacts, '', null);
    expect(prompt).not.toContain('REAL DESTINATION FACTS');
  });

  it('includes consider-list ideas as soft suggestions, not requirements', () => {
    const prompt = buildPrompt([member()], 'none', null, null, noFacts, '- Ichiran Ramen [CONFIRMED REAL PLACE]', null);
    // Constraint 3 always explains what the consider-list *means* (soft
    // suggestions, never a conflict if omitted) even when the list itself is
    // empty - it's the actual section header + body that's conditional, so
    // that's what distinguishes "has ideas" from "has none" here.
    expect(prompt).toContain('not requirements, just things people found worth sharing');
    expect(prompt).toContain('Ichiran Ramen');
  });

  it('omits the consider-list section when there are no ideas', () => {
    const prompt = buildPrompt([member()], 'none', null, null, noFacts, '', null);
    expect(prompt).not.toContain('not requirements, just things people found worth sharing');
  });

  it('includes the current draft and the revise-in-place instruction when one exists', () => {
    const prompt = buildPrompt([member()], 'none', null, null, noFacts, '', 'Version 1, total budget $200:\nDay 1...');
    expect(prompt).toContain('CURRENT DRAFT');
    // This is the constraint that had a real bug: the first version of this
    // wording caused the model to leave the draft untouched even when new
    // information should have changed it - both directions matter.
    expect(prompt).toContain('do not reshuffle, rewrite, or swap out things that are still working');
    expect(prompt).toContain('actually incorporate it where it reasonably fits');
  });

  it('omits the draft and revise-in-place instruction on a first synthesis', () => {
    const prompt = buildPrompt([member()], 'none', null, null, noFacts, '', null);
    expect(prompt).not.toContain('CURRENT DRAFT');
    expect(prompt).not.toContain('REVISION of the group\'s existing plan');
  });

  it('anchors the budget constraint to the average of all members\' stated budgets', () => {
    const prompt = buildPrompt(
      [member({ userId: 'user-1', budgetPerDay: 100 }), member({ userId: 'user-2', budgetPerDay: 200 })],
      'none',
      null,
      null,
      noFacts,
      '',
      null,
    );
    expect(prompt).toContain('$150');
  });

  it('falls back to "none specified" for a member\'s empty fields', () => {
    const prompt = buildPrompt([member({ destinations: [], mustSee: [], dealbreakers: [] })], 'none', null, null, noFacts, '', null);
    expect(prompt).toContain('Destinations wanted: none specified');
    expect(prompt).toContain('Must see: none specified');
    expect(prompt).toContain('Dealbreakers: none specified');
  });
});

describe('formatCurrentDraft', () => {
  beforeAll(connectTestMongo);
  afterAll(disconnectTestMongo);
  beforeEach(resetDatabase);

  it('returns null when no itinerary exists yet for the trip', async () => {
    expect(await formatCurrentDraft('trip-1')).toBeNull();
  });

  it('formats the latest version\'s days, budget, and consensus score', async () => {
    await ItineraryVersion.create({
      tripId: 'trip-1',
      version: 1,
      days: [{ destination: 'Paris', activities: ['Louvre', 'Eiffel Tower'], accommodation: 'Hotel A', cost: 150 }],
      totalBudget: 150,
      consensusScore: 80,
      compromisesMade: [],
    });

    const formatted = await formatCurrentDraft('trip-1');
    expect(formatted).toContain('Version 1');
    expect(formatted).toContain('$150');
    expect(formatted).toContain('80/100');
    expect(formatted).toContain('Paris');
    expect(formatted).toContain('Louvre, Eiffel Tower');
  });

  it('uses the latest version, not the first one created', async () => {
    await ItineraryVersion.create([
      {
        tripId: 'trip-1',
        version: 1,
        days: [{ destination: 'Paris', activities: [], accommodation: '', cost: 100 }],
        totalBudget: 100,
        compromisesMade: [],
      },
      {
        tripId: 'trip-1',
        version: 2,
        days: [{ destination: 'Rome', activities: [], accommodation: '', cost: 120 }],
        totalBudget: 120,
        compromisesMade: [],
        editedBy: 'user-1',
      },
    ]);

    const formatted = await formatCurrentDraft('trip-1');
    expect(formatted).toContain('Version 2');
    expect(formatted).toContain('Rome');
    expect(formatted).not.toContain('Paris');
  });
});

describe('editItineraryDay', () => {
  beforeAll(connectTestMongo);
  afterAll(disconnectTestMongo);
  beforeEach(resetDatabase);

  it('throws when no itinerary exists yet for the trip', async () => {
    await expect(editItineraryDay('trip-1', 'user-1', 0, { cost: 100 })).rejects.toThrow(HttpError);
  });

  it('throws when the day index is out of range', async () => {
    await ItineraryVersion.create({
      tripId: 'trip-1',
      version: 1,
      days: [{ destination: 'Paris', activities: [], accommodation: '', cost: 100 }],
      totalBudget: 100,
      compromisesMade: [],
    });

    await expect(editItineraryDay('trip-1', 'user-1', 5, { cost: 100 })).rejects.toThrow(HttpError);
    await expect(editItineraryDay('trip-1', 'user-1', -1, { cost: 100 })).rejects.toThrow(HttpError);
  });

  it('throws when no fields are provided to update', async () => {
    await ItineraryVersion.create({
      tripId: 'trip-1',
      version: 1,
      days: [{ destination: 'Paris', activities: [], accommodation: '', cost: 100 }],
      totalBudget: 100,
      compromisesMade: [],
    });

    await expect(editItineraryDay('trip-1', 'user-1', 0, {})).rejects.toThrow(HttpError);
  });

  it('creates a new version with only the target day changed, editedBy set', async () => {
    await ItineraryVersion.create({
      tripId: 'trip-1',
      version: 1,
      days: [
        { destination: 'Paris', activities: ['Louvre'], accommodation: 'Hotel A', cost: 100 },
        { destination: 'Rome', activities: ['Colosseum'], accommodation: 'Hotel B', cost: 120 },
      ],
      totalBudget: 220,
      consensusScore: 70,
      compromisesMade: ['Split time between cities'],
    });

    const result = await editItineraryDay('trip-1', 'user-1', 0, {
      activities: ['Notre Dame'],
      accommodation: 'Hotel C',
      cost: 90,
    });

    expect(result.version).toBe(2);
    expect(result.editedBy).toBe('user-1');
    // toMatchObject, not toEqual: result.days[n] is a live Mongoose
    // subdocument at runtime (despite the plain ItineraryDayPayload type),
    // carrying internal Mongoose state that toEqual would treat as a
    // mismatch even when every actual field matches.
    expect(result.days[0]).toMatchObject({ destination: 'Paris', activities: ['Notre Dame'], accommodation: 'Hotel C', cost: 90 });
    // Untouched day and trip-level fields carry over unchanged.
    expect(result.days[1]).toMatchObject({ destination: 'Rome', activities: ['Colosseum'], accommodation: 'Hotel B', cost: 120 });
    expect(result.totalBudget).toBe(220);
    expect(result.consensusScore).toBe(70);
    expect(result.compromisesMade).toEqual(['Split time between cities']);
  });

  it('leaves fields not included in the update unchanged for that same day', async () => {
    await ItineraryVersion.create({
      tripId: 'trip-1',
      version: 1,
      days: [{ destination: 'Paris', activities: ['Louvre'], accommodation: 'Hotel A', cost: 100 }],
      totalBudget: 100,
      compromisesMade: [],
    });

    // Only cost is being edited - activities/accommodation should carry over.
    const result = await editItineraryDay('trip-1', 'user-1', 0, { cost: 150 });

    expect(result.days[0]).toMatchObject({ destination: 'Paris', activities: ['Louvre'], accommodation: 'Hotel A', cost: 150 });
  });
});

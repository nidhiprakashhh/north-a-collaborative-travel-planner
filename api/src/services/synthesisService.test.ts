import { describe, it, expect } from 'vitest';
import { fuzzyIncludes, coerceStringArray } from './synthesisService';

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

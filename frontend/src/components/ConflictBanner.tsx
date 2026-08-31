import type { ItineraryUpdatedPayload } from '../types/socket';
import type { TripMember } from '../types/api';

interface ConflictBannerProps {
  itinerary: ItineraryUpdatedPayload | null;
  members: TripMember[];
}

// Conflict content itself still comes from the LLM synthesis step (plus a
// few deterministic guardrails added server-side — see synthesisService.ts),
// but attribution is structured: each entry carries memberIds, which we
// resolve to names here so it's clear whose preference is actually at stake.
export function ConflictBanner({ itinerary, members }: ConflictBannerProps) {
  if (!itinerary || itinerary.conflictsDetected.length === 0) {
    return null;
  }

  const nameById = new Map(members.map((m) => [m.userId, m.user.name]));

  return (
    // White, not the sunshine wash — the page background is now a warm
    // yellow too, so a sunshine-soft card would nearly disappear into it.
    // The thick sunshine border carries the "this is a warning" signal.
    <div className="rounded-xl border-2 border-sunshine bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-sunshine">Conflicts detected</div>
      <ul className="mt-1 list-inside list-disc text-sm text-ink">
        {itinerary.conflictsDetected.map((c, i) => {
          const names = c.memberIds.map((id) => nameById.get(id)).filter(Boolean);
          return (
            <li key={i}>
              {c.description}
              {names.length > 0 && <span className="text-ink-soft"> (affects: {names.join(', ')})</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

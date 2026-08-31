import { useMemo, useState } from 'react';
import type { TripPreferenceState } from '../hooks/useTrip';

interface VotingPanelProps {
  preferencesByUser: Record<string, TripPreferenceState>;
  voteTallies: Record<string, number>;
  onCastVote: (destination: string) => void;
}

// Candidate destinations are derived from the union of every member's
// submitted `destinations` — there's no separate "destination options"
// concept stored server-side, so whatever anyone has proposed is votable.
export function VotingPanel({ preferencesByUser, voteTallies, onCastVote }: VotingPanelProps) {
  const [myVote, setMyVote] = useState<string | null>(null);

  const candidates = useMemo(() => {
    const set = new Set<string>();
    for (const pref of Object.values(preferencesByUser)) {
      pref.destinations.forEach((d) => set.add(d));
    }
    Object.keys(voteTallies).forEach((d) => set.add(d));
    return Array.from(set).sort((a, b) => (voteTallies[b] ?? 0) - (voteTallies[a] ?? 0));
  }, [preferencesByUser, voteTallies]);

  function handleVote(destination: string) {
    setMyVote(destination);
    onCastVote(destination);
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded-xl bg-white p-4 text-sm text-ink-soft shadow-sm">
        No destinations proposed yet, add some in your preferences to start voting.
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-ink">Vote on destinations</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {candidates.map((destination) => {
          const isMine = myVote === destination;
          return (
            <button
              key={destination}
              onClick={() => handleVote(destination)}
              className={`rounded-lg border p-4 text-left transition ${
                isMine ? 'border-sky bg-sky text-white' : 'border-haze-200 hover:border-sky'
              }`}
            >
              <div className="font-medium">{destination}</div>
              <div className={`text-xs ${isMine ? 'text-white/80' : 'text-ink-soft'}`}>
                {voteTallies[destination] ?? 0} vote{(voteTallies[destination] ?? 0) === 1 ? '' : 's'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

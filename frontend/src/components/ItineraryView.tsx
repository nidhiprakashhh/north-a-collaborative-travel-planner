import { useState } from 'react';
import type { ItineraryUpdatedPayload, PresenceUser } from '../types/socket';
import type { TripMember } from '../types/api';

interface ItineraryViewProps {
  itinerary: ItineraryUpdatedPayload | null;
  isSynthesizing: boolean;
  members: TripMember[];
  presence: PresenceUser[];
  onRegenerate: () => void;
  regenerateDisabled: boolean;
  onEditDay: (dayIndex: number, updates: { activities?: string[]; accommodation?: string; cost?: number }) => void;
  onFocusField: (field: string) => void;
}

interface DayDraft {
  activities: string;
  accommodation: string;
  cost: string;
}

function editingFieldFor(dayIndex: number): string {
  return `itinerary day ${dayIndex + 1}`;
}

export function ItineraryView({
  itinerary,
  isSynthesizing,
  members,
  presence,
  onRegenerate,
  regenerateDisabled,
  onEditDay,
  onFocusField,
}: ItineraryViewProps) {
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [draft, setDraft] = useState<DayDraft>({ activities: '', accommodation: '', cost: '' });

  const nameById = new Map(members.map((m) => [m.userId, m.user.name]));

  function startEdit(dayIndex: number) {
    if (!itinerary) return;
    const day = itinerary.days[dayIndex];
    setDraft({ activities: day.activities.join(', '), accommodation: day.accommodation, cost: String(day.cost) });
    setEditingDay(dayIndex);
    onFocusField(editingFieldFor(dayIndex));
  }

  function cancelEdit() {
    setEditingDay(null);
  }

  function saveEdit(dayIndex: number) {
    onEditDay(dayIndex, {
      activities: draft.activities
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      accommodation: draft.accommodation.trim(),
      cost: Number(draft.cost) || 0,
    });
    setEditingDay(null);
  }

  function editorsFor(dayIndex: number): string[] {
    const field = editingFieldFor(dayIndex);
    return presence.filter((p) => p.editingField === field).map((p) => p.name);
  }

  const inputClass = 'rounded-lg border border-haze-200 bg-white px-2 py-1 text-sm focus:border-sky focus:outline-none';

  return (
    <div className="space-y-3 rounded-xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-ink">
          Itinerary{' '}
          {itinerary && (
            <span className="font-sans text-sm font-normal text-ink-faint">
              (v{itinerary.version}
              {itinerary.editedBy && `, edited by ${nameById.get(itinerary.editedBy) ?? 'someone'}`})
            </span>
          )}
        </h2>
        <button
          onClick={onRegenerate}
          disabled={isSynthesizing || regenerateDisabled}
          className="rounded-lg bg-sky px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-dark disabled:opacity-40"
        >
          {isSynthesizing ? 'Synthesizing...' : 'Regenerate'}
        </button>
      </div>

      {isSynthesizing && (
        <div className="flex items-center gap-2 rounded-lg bg-white p-4 text-sm text-ink-soft">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-haze-200 border-t-sky" />
          Synthesizing an itinerary from everyone's preferences...
        </div>
      )}

      {!isSynthesizing && !itinerary && (
        <p className="text-sm text-ink-soft">
          No itinerary yet, submit preferences and votes, one will generate automatically a few seconds after the
          last edit.
        </p>
      )}

      {!isSynthesizing && itinerary && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm text-ink-soft">
            <span>
              Total budget: <strong className="text-ink">${itinerary.totalBudget}</strong>
            </span>
            <span>
              Consensus score: <strong className="text-ink">{itinerary.consensusScore}/100</strong>
            </span>
          </div>

          <ol className="space-y-2">
            {itinerary.days.map((day, i) => {
              const editors = editorsFor(i);
              const isEditingThis = editingDay === i;

              return (
                <li key={i} className="rounded-lg border border-haze-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">Day {i + 1}</div>
                    {!isEditingThis && (
                      <button
                        onClick={() => startEdit(i)}
                        className="text-xs text-ink-faint underline hover:text-sky"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <div className="font-medium text-ink">{day.destination}</div>

                  {isEditingThis ? (
                    <div className="mt-1 space-y-1.5">
                      <input
                        className={`w-full ${inputClass}`}
                        value={draft.activities}
                        onChange={(e) => setDraft({ ...draft, activities: e.target.value })}
                        placeholder="Activities, comma-separated"
                      />
                      <div className="flex gap-1.5">
                        <input
                          className={`min-w-0 flex-[2] ${inputClass}`}
                          value={draft.accommodation}
                          onChange={(e) => setDraft({ ...draft, accommodation: e.target.value })}
                          placeholder="Accommodation"
                        />
                        <input
                          type="number"
                          className={`w-20 ${inputClass}`}
                          value={draft.cost}
                          onChange={(e) => setDraft({ ...draft, cost: e.target.value })}
                          placeholder="Cost"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(i)}
                          className="rounded-lg bg-sky px-2.5 py-1 text-xs font-medium text-white transition hover:bg-sky-dark"
                        >
                          Save
                        </button>
                        <button onClick={cancelEdit} className="text-xs text-ink-faint hover:text-ink">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-ink-soft">{day.activities.join(', ')}</div>
                      <div className="text-xs text-ink-faint">
                        {day.accommodation} &middot; ${day.cost}
                      </div>
                    </>
                  )}

                  {editors.length > 0 && !isEditingThis && (
                    <div className="mt-1 text-xs italic text-sky">
                      {editors.join(', ')} {editors.length === 1 ? 'is' : 'are'} editing this day...
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {itinerary.compromisesMade.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">Compromises made</div>
              <ul className="list-inside list-disc text-sm text-ink-soft">
                {itinerary.compromisesMade.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

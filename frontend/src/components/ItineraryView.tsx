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

  return (
    <div className="space-y-3 rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Itinerary{' '}
          {itinerary && (
            <span className="font-normal text-slate-400">
              (v{itinerary.version}
              {itinerary.editedBy && `, edited by ${nameById.get(itinerary.editedBy) ?? 'someone'}`})
            </span>
          )}
        </h2>
        <button
          onClick={onRegenerate}
          disabled={isSynthesizing || regenerateDisabled}
          className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          {isSynthesizing ? 'Synthesizing...' : 'Regenerate'}
        </button>
      </div>

      {isSynthesizing && (
        <div className="flex items-center gap-2 rounded bg-slate-50 p-3 text-sm text-slate-500">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
          Synthesizing an itinerary from everyone's preferences...
        </div>
      )}

      {!isSynthesizing && !itinerary && (
        <p className="text-sm text-slate-500">
          No itinerary yet — submit preferences and votes, one will generate automatically a few seconds after the
          last edit.
        </p>
      )}

      {!isSynthesizing && itinerary && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            <span>
              Total budget: <strong>${itinerary.totalBudget}</strong>
            </span>
            <span>
              Consensus score: <strong>{itinerary.consensusScore}/100</strong>
            </span>
          </div>

          <ol className="space-y-2">
            {itinerary.days.map((day, i) => {
              const editors = editorsFor(i);
              const isEditingThis = editingDay === i;

              return (
                <li key={i} className="rounded border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Day {i + 1}</div>
                    {!isEditingThis && (
                      <button
                        onClick={() => startEdit(i)}
                        className="text-xs text-slate-400 underline hover:text-slate-600"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <div className="font-medium">{day.destination}</div>

                  {isEditingThis ? (
                    <div className="mt-1 space-y-1.5">
                      <input
                        className="w-full rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
                        value={draft.activities}
                        onChange={(e) => setDraft({ ...draft, activities: e.target.value })}
                        placeholder="Activities, comma-separated"
                      />
                      <div className="flex gap-1.5">
                        <input
                          className="min-w-0 flex-[2] rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
                          value={draft.accommodation}
                          onChange={(e) => setDraft({ ...draft, accommodation: e.target.value })}
                          placeholder="Accommodation"
                        />
                        <input
                          type="number"
                          className="w-20 rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
                          value={draft.cost}
                          onChange={(e) => setDraft({ ...draft, cost: e.target.value })}
                          placeholder="Cost"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(i)}
                          className="rounded bg-slate-800 px-2.5 py-1 text-xs font-medium text-white"
                        >
                          Save
                        </button>
                        <button onClick={cancelEdit} className="text-xs text-slate-400 hover:text-slate-600">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-sm text-slate-600">{day.activities.join(', ')}</div>
                      <div className="text-xs text-slate-500">
                        {day.accommodation} &middot; ${day.cost}
                      </div>
                    </>
                  )}

                  {editors.length > 0 && !isEditingThis && (
                    <div className="mt-1 text-xs italic text-slate-400">
                      {editors.join(', ')} {editors.length === 1 ? 'is' : 'are'} editing this day...
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {itinerary.compromisesMade.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Compromises made</div>
              <ul className="list-inside list-disc text-sm text-slate-600">
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

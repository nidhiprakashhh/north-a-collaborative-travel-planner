import type { ItineraryUpdatedPayload } from '../types/socket';

interface ItineraryViewProps {
  itinerary: ItineraryUpdatedPayload | null;
  isSynthesizing: boolean;
  onRegenerate: () => void;
  regenerateDisabled: boolean;
}

export function ItineraryView({ itinerary, isSynthesizing, onRegenerate, regenerateDisabled }: ItineraryViewProps) {
  return (
    <div className="space-y-3 rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          Itinerary {itinerary && <span className="font-normal text-slate-400">(v{itinerary.version})</span>}
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
            {itinerary.days.map((day, i) => (
              <li key={i} className="rounded border border-slate-100 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Day {i + 1}</div>
                <div className="font-medium">{day.destination}</div>
                <div className="text-sm text-slate-600">{day.activities.join(', ')}</div>
                <div className="text-xs text-slate-500">
                  {day.accommodation} &middot; ${day.cost}
                </div>
              </li>
            ))}
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

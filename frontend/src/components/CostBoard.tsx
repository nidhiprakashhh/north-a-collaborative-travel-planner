import { useState } from 'react';
import type { CostItemDTO, CostCategory, TripMember } from '../types/api';

interface CostBoardProps {
  items: CostItemDTO[];
  total: number;
  members: TripMember[];
  onAdd: (label: string, amount: number, category?: CostCategory) => void;
  onRemove: (itemId: string) => void;
}

const CATEGORIES: { value: CostCategory; label: string }[] = [
  { value: 'flight', label: 'Flight' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'food', label: 'Food' },
  { value: 'activity', label: 'Activity' },
  { value: 'transport', label: 'Transport' },
  { value: 'other', label: 'Other' },
];

// A real, member-entered running total, next to (never in place of) the
// itinerary's per-day "cost" field, which is still just the LLM's estimate
// - the two are shown separately and labeled as such, deliberately, rather
// than trying to reconcile a guess with a real number. Same shared-list
// shape as ConsiderBoard: discrete per-item documents, live-synced, anyone
// can remove anything.
export function CostBoard({ items, total, members, onAdd, onRemove }: CostBoardProps) {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<CostCategory>('other');

  const nameById = new Map(members.map((m) => [m.userId, m.user.name]));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (!label.trim() || !amount || Number.isNaN(parsed) || parsed < 0) return;
    onAdd(label.trim(), parsed, category);
    setLabel('');
    setAmount('');
    setCategory('other');
  }

  return (
    <div className="space-y-3 rounded-lg bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Trip costs</h2>
          <p className="text-xs italic text-slate-500">what members actually logged, not an estimate</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-slate-800">${total.toFixed(0)}</div>
          <div className="text-xs text-slate-400">actual total</div>
        </div>
      </div>

      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id} className="group flex items-center gap-2 py-0.5 text-sm">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                {CATEGORIES.find((c) => c.value === item.category)?.label ?? item.category}
              </span>
              <span className="min-w-0 flex-1 truncate text-slate-800">{item.label}</span>
              <span className="shrink-0 text-xs text-slate-400">{nameById.get(item.addedBy) ?? 'someone'}</span>
              <span className="shrink-0 font-medium text-slate-700">${item.amount.toFixed(0)}</span>
              <button
                onClick={() => onRemove(item.id)}
                className="shrink-0 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-slate-500"
                aria-label={`Remove ${item.label}`}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <input
          className="min-w-0 flex-[2] rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
          placeholder="What did it cost — a flight, a hotel..."
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <select
          className="rounded border border-slate-200 px-1.5 py-1 text-sm text-slate-600 focus:border-slate-400 focus:outline-none"
          value={category}
          onChange={(e) => setCategory(e.target.value as CostCategory)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          step="0.01"
          className="w-24 rounded border border-slate-200 px-2 py-1 text-sm focus:border-slate-400 focus:outline-none"
          placeholder="$"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button
          type="submit"
          className="shrink-0 rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
          disabled={!label.trim() || !amount}
        >
          Add
        </button>
      </form>
    </div>
  );
}

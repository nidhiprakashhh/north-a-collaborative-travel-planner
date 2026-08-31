import { useState } from 'react';
import type { CostItemDTO, CostCategory, TripMember } from '../types/api';

interface CostBoardProps {
  items: CostItemDTO[];
  total: number;
  members: TripMember[];
  onAdd: (label: string, amount: number, category?: CostCategory) => void;
  onRemove: (itemId: string) => void;
}

// Each category gets a color from the same small pastel spectrum used for
// member avatars, so a glance at the list sorts itself by kind of cost even
// before reading the label. "Other" deliberately stays neutral rather than
// reusing sky, which is reserved for actions/links, not passive tags.
const CATEGORIES: { value: CostCategory; label: string; tag: string }[] = [
  { value: 'flight', label: 'Flight', tag: 'bg-sky-soft text-sky-dark' },
  { value: 'lodging', label: 'Lodging', tag: 'bg-haze-200 text-ink-soft' },
  { value: 'food', label: 'Food', tag: 'bg-sunshine-soft text-ink' },
  { value: 'activity', label: 'Activity', tag: 'bg-grass-soft text-grass' },
  { value: 'transport', label: 'Transport', tag: 'bg-sky-soft text-sky-dark' },
  { value: 'other', label: 'Other', tag: 'bg-haze-200 text-ink-soft' },
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
    <div className="space-y-3 rounded-xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">Trip costs</h2>
          <p className="text-xs italic text-ink-soft">what members actually logged, not an estimate</p>
        </div>
        <div className="text-right">
          <div className="font-display text-lg font-semibold text-ink">${total.toFixed(0)}</div>
          <div className="text-xs text-ink-faint">actual total</div>
        </div>
      </div>

      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item) => {
            const tag = CATEGORIES.find((c) => c.value === item.category);
            return (
              <li key={item.id} className="group flex items-center gap-2 py-0.5 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tag?.tag ?? 'bg-haze-200 text-ink-soft'}`}>
                  {tag?.label ?? item.category}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">{item.label}</span>
                <span className="shrink-0 text-xs text-ink-faint">{nameById.get(item.addedBy) ?? 'someone'}</span>
                <span className="shrink-0 font-medium text-ink">${item.amount.toFixed(0)}</span>
                <button
                  onClick={() => onRemove(item.id)}
                  className="shrink-0 text-ink-faint opacity-0 transition group-hover:opacity-100 hover:text-sky"
                  aria-label={`Remove ${item.label}`}
                >
                  &times;
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <input
          className="min-w-0 flex-[2] rounded-lg border border-haze-200 bg-white px-2 py-1 text-sm focus:border-sky focus:outline-none"
          placeholder="What did it cost, a flight, a hotel..."
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <select
          className="rounded-lg border border-haze-200 bg-white px-1.5 py-1 text-sm text-ink-soft focus:border-sky focus:outline-none"
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
          className="w-24 rounded-lg border border-haze-200 bg-white px-2 py-1 text-sm focus:border-sky focus:outline-none"
          placeholder="$"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-sky px-3 py-1 text-xs font-medium text-white transition hover:bg-sky-dark disabled:opacity-40"
          disabled={!label.trim() || !amount}
        >
          Add
        </button>
      </form>
    </div>
  );
}

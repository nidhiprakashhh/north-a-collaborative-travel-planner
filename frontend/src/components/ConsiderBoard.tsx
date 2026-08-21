import { useState } from 'react';
import type { ConsiderIdeaDTO, TripMember } from '../types/api';

interface ConsiderBoardProps {
  ideas: ConsiderIdeaDTO[];
  members: TripMember[];
  onAdd: (name: string, link?: string) => void;
  onRemove: (ideaId: string) => void;
}

// A shared, visible list everyone in the trip can see and add to live —
// unlike preferences, this isn't per-member data that only reaches other
// people indirectly through the synthesized itinerary. Deliberately plain:
// a post-it color tint on each entry, no rotation or tape — the fuller
// sticky-note treatment was explicitly more than wanted here.
export function ConsiderBoard({ ideas, members, onAdd, onRemove }: ConsiderBoardProps) {
  const [name, setName] = useState('');
  const [link, setLink] = useState('');

  const nameById = new Map(members.map((m) => [m.userId, m.user.name]));

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd(name.trim(), link.trim() || undefined);
    setName('');
    setLink('');
  }

  return (
    <div className="space-y-3 rounded-lg bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">Worth considering</h2>
        <p className="text-xs text-slate-500">
          Drop in names or links anyone found — not must-see, just ideas for the group.
        </p>
      </div>

      <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
        <input
          className="min-w-[10rem] flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
          placeholder="Ichiran Ramen, that café from Instagram..."
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="min-w-[8rem] flex-1 rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-slate-400 focus:outline-none"
          placeholder="Link (optional)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          disabled={!name.trim()}
        >
          Add
        </button>
      </form>

      {ideas.length === 0 ? (
        <p className="text-sm text-slate-400">Nothing added yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {ideas.map((idea) => (
            <li
              key={idea.id}
              className="flex items-center justify-between gap-2 rounded bg-amber-50 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <span className="font-medium text-slate-800">{idea.name}</span>
                {idea.link && (
                  <a
                    href={idea.link}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-2 text-xs text-slate-500 underline"
                  >
                    link
                  </a>
                )}
                <div className="text-xs text-slate-500">added by {nameById.get(idea.addedBy) ?? 'someone'}</div>
              </div>
              <button
                onClick={() => onRemove(idea.id)}
                className="shrink-0 text-slate-400 hover:text-slate-600"
                aria-label={`Remove ${idea.name}`}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

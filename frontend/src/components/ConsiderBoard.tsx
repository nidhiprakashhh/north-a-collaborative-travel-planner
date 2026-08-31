import { useState } from 'react';
import type { ConsiderIdeaDTO, TripMember } from '../types/api';

interface ConsiderBoardProps {
  ideas: ConsiderIdeaDTO[];
  members: TripMember[];
  onAdd: (name: string, link?: string) => void;
  onRemove: (ideaId: string) => void;
}

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

// Renders a line of typed text with any URL substrings turned into real
// links, so people can just paste "Ichiran Ramen - https://..." inline
// instead of filling out a separate link field.
function renderWithLinks(text: string) {
  const parts = text.split(URL_PATTERN);
  return parts.map((part, i) =>
    URL_PATTERN.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className="text-sky underline">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

// A shared, visible list everyone in the trip can see and add to live,
// unlike preferences, this isn't per-member data that only reaches other
// people indirectly through the synthesized itinerary. Styled to read as
// one open page people are jotting into together (flowing lines, no boxed
// input/button, no per-entry card chrome) rather than another form next to
// the preference form — the underlying data is still discrete per-idea
// documents (no shared-text merge risk), just presented without the form
// framing.
export function ConsiderBoard({ ideas, members, onAdd, onRemove }: ConsiderBoardProps) {
  const [draft, setDraft] = useState('');

  const nameById = new Map(members.map((m) => [m.userId, m.user.name]));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft('');
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-ink">Worth considering</h2>
      <p className="mb-3 text-xs italic text-ink-soft">not must-see, just ideas anyone found</p>

      <div className="space-y-1.5">
        {ideas.map((idea) => (
          <div key={idea.id} className="group flex items-baseline gap-2 py-0.5 text-sm text-ink">
            <span className="min-w-0 flex-1">{renderWithLinks(idea.name)}</span>
            <span className="shrink-0 text-xs text-ink-faint">&middot; {nameById.get(idea.addedBy) ?? 'someone'}</span>
            <button
              onClick={() => onRemove(idea.id)}
              className="shrink-0 text-ink-faint opacity-0 transition group-hover:opacity-100 hover:text-sky"
              aria-label={`Remove ${idea.name}`}
            >
              &times;
            </button>
          </div>
        ))}

        <form onSubmit={handleSubmit}>
          <input
            className="w-full border-0 border-b border-transparent bg-transparent py-0.5 text-sm text-ink placeholder:text-ink-faint focus:border-sky focus:outline-none"
            placeholder="Type an idea and press Enter, a place, a link, anything..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
        </form>
      </div>
    </div>
  );
}

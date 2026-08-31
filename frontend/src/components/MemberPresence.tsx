import type { TripMember } from '../types/api';
import type { PresenceUser } from '../types/socket';

interface MemberPresenceProps {
  members: TripMember[];
  presence: PresenceUser[];
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// Each member gets a color from the same small pastel spectrum used for cost
// categories, picked deterministically from their id — a stable, distinct
// hue per person is what makes a group of avatars actually read as a group
// rather than a row of identical dark circles.
const AVATAR_COLORS = ['bg-sky', 'bg-grass', 'bg-sunshine'];

function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function MemberPresence({ members, presence }: MemberPresenceProps) {
  const onlineIds = new Set(presence.map((p) => p.userId));
  const editingByUser = new Map(presence.filter((p) => p.editingField).map((p) => [p.userId, p.editingField]));

  return (
    <div className="flex flex-wrap gap-3">
      {members.map((member) => {
        const online = onlineIds.has(member.userId);
        const editingField = editingByUser.get(member.userId);
        return (
          <div key={member.id} className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm">
            <span
              className={`relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColorFor(member.userId)}`}
            >
              {initials(member.user.name)}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                  online ? 'bg-grass' : 'bg-haze-200'
                }`}
              />
            </span>
            <div className="text-sm">
              <div className="font-medium leading-tight text-ink">{member.user.name}</div>
              {editingField && <div className="text-xs leading-tight text-ink-soft">editing {editingField}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

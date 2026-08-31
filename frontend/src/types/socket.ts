// Hand-kept mirror of api/src/socket/types.ts. Keep in sync manually when
// the backend's event contracts change — see the note in types/api.ts for
// why this isn't a shared package.
import type { ItineraryDay, ConflictEntry, CostCategory } from './api';

export interface PresenceUser {
  userId: string;
  name: string;
  editingField?: string;
}

// ---- Client -> Server payloads ----

export interface JoinTripPayload {
  tripId: string;
}

export interface LeaveTripPayload {
  tripId: string;
}

export interface PreferenceUpdatePayload {
  tripId: string;
  destinations?: string[];
  availableDates?: string[];
  budgetPerDay?: number;
  activityTypes?: string[];
  mustSee?: string[];
  dealbreakers?: string[];
}

export interface VoteCastPayload {
  tripId: string;
  destination: string;
}

export interface CursorUpdatePayload {
  tripId: string;
  field: string;
}

export interface ConsiderAddPayload {
  tripId: string;
  name: string;
  link?: string;
}

export interface ConsiderRemovePayload {
  tripId: string;
  ideaId: string;
}

export interface ItineraryEditPayload {
  tripId: string;
  dayIndex: number;
  activities?: string[];
  accommodation?: string;
  cost?: number;
}

export interface CostAddPayload {
  tripId: string;
  label: string;
  amount: number;
  category?: CostCategory;
}

export interface CostRemovePayload {
  tripId: string;
  itemId: string;
}

// ---- Server -> Client payloads ----

export interface PresenceStatePayload {
  tripId: string;
  users: PresenceUser[];
}

export interface UserJoinedPayload {
  tripId: string;
  user: PresenceUser;
}

export interface UserLeftPayload {
  tripId: string;
  userId: string;
}

export interface PreferenceBroadcastPayload {
  tripId: string;
  userId: string;
  preference: {
    destinations: string[];
    availableDates: string[];
    budgetPerDay: number;
    activityTypes: string[];
    mustSee: string[];
    dealbreakers: string[];
    updatedAt: string;
  };
}

export interface VoteTallyPayload {
  tripId: string;
  tallies: Record<string, number>;
}

export interface CursorBroadcastPayload {
  tripId: string;
  userId: string;
  field: string;
}

export interface SynthesisStartedPayload {
  tripId: string;
}

export interface ItineraryUpdatedPayload {
  tripId: string;
  version: number;
  days: ItineraryDay[];
  totalBudget: number;
  conflictsDetected: ConflictEntry[];
  consensusScore: number;
  compromisesMade: string[];
  editedBy?: string;
  createdAt: string;
}

export interface ErrorPayload {
  message: string;
}

export interface ConsiderIdeaPayload {
  id: string;
  name: string;
  link?: string;
  addedBy: string;
  createdAt: string;
}

export interface ConsiderAddedPayload {
  tripId: string;
  idea: ConsiderIdeaPayload;
}

export interface ConsiderRemovedPayload {
  tripId: string;
  ideaId: string;
}

export interface CostItemPayload {
  id: string;
  label: string;
  amount: number;
  category: CostCategory;
  addedBy: string;
  createdAt: string;
}

export interface CostAddedPayload {
  tripId: string;
  item: CostItemPayload;
}

export interface CostRemovedPayload {
  tripId: string;
  itemId: string;
}

export interface ServerToClientEvents {
  presence_state: (payload: PresenceStatePayload) => void;
  user_joined: (payload: UserJoinedPayload) => void;
  user_left: (payload: UserLeftPayload) => void;
  preference_broadcast: (payload: PreferenceBroadcastPayload) => void;
  vote_tally_update: (payload: VoteTallyPayload) => void;
  cursor_broadcast: (payload: CursorBroadcastPayload) => void;
  synthesis_started: (payload: SynthesisStartedPayload) => void;
  itinerary_updated: (payload: ItineraryUpdatedPayload) => void;
  consider_added: (payload: ConsiderAddedPayload) => void;
  consider_removed: (payload: ConsiderRemovedPayload) => void;
  cost_added: (payload: CostAddedPayload) => void;
  cost_removed: (payload: CostRemovedPayload) => void;
  error_message: (payload: ErrorPayload) => void;
}

export interface JoinTripAck {
  ok: boolean;
  error?: string;
}

export interface ClientToServerEvents {
  join_trip: (payload: JoinTripPayload, ack?: (result: JoinTripAck) => void) => void;
  leave_trip: (payload: LeaveTripPayload) => void;
  preference_update: (payload: PreferenceUpdatePayload) => void;
  vote_cast: (payload: VoteCastPayload) => void;
  cursor_update: (payload: CursorUpdatePayload) => void;
  consider_add: (payload: ConsiderAddPayload) => void;
  consider_remove: (payload: ConsiderRemovePayload) => void;
  itinerary_edit: (payload: ItineraryEditPayload) => void;
  cost_add: (payload: CostAddPayload) => void;
  cost_remove: (payload: CostRemovePayload) => void;
}

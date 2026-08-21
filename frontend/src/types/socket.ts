// Hand-kept mirror of api/src/socket/types.ts. Keep in sync manually when
// the backend's event contracts change — see the note in types/api.ts for
// why this isn't a shared package.
import type { ItineraryDay, ConflictEntry } from './api';

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
  considerPlaces?: string[];
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
    considerPlaces: string[];
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
  createdAt: string;
}

export interface ErrorPayload {
  message: string;
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
}

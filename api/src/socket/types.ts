import { Server, Socket } from 'socket.io';

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
    updatedAt: Date;
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

export interface ErrorPayload {
  message: string;
}

export interface ItineraryDayPayload {
  destination: string;
  activities: string[];
  accommodation: string;
  cost: number;
}

export interface ConflictEntryPayload {
  description: string;
  memberIds: string[];
}

export interface ItineraryUpdatedPayload {
  tripId: string;
  version: number;
  days: ItineraryDayPayload[];
  totalBudget: number;
  conflictsDetected: ConflictEntryPayload[];
  consensusScore: number;
  compromisesMade: string[];
  createdAt: Date;
}

export interface SynthesisStartedPayload {
  tripId: string;
}

export interface JoinTripAck {
  ok: boolean;
  error?: string;
}

export interface ClientToServerEvents {
  // The ack lets the client know the server has actually finished joining
  // the room before it allows preference_update/vote_cast/cursor_update —
  // otherwise those could reach the server (and get broadcast to the room)
  // before this socket is in it, so the sender never sees its own update.
  join_trip: (payload: JoinTripPayload, ack?: (result: JoinTripAck) => void) => void;
  leave_trip: (payload: LeaveTripPayload) => void;
  preference_update: (payload: PreferenceUpdatePayload) => void;
  vote_cast: (payload: VoteCastPayload) => void;
  cursor_update: (payload: CursorUpdatePayload) => void;
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

// eslint-disable-next-line @typescript-eslint/no-empty-interface -- required by socket.io's generic signature, unused for now
export interface InterServerEvents {}

export interface SocketData {
  userId: string;
  email: string;
  name: string;
  currentTripId?: string;
}

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

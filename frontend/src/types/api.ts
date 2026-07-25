// REST DTOs — hand-kept mirror of the shapes api/src returns. There's no
// shared package between /api and /frontend, so these are duplicated
// deliberately rather than adding cross-project build tooling for one file.

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

export type TripRole = 'owner' | 'member';

export interface TripMember {
  id: string;
  tripId: string;
  userId: string;
  role: TripRole;
  joinedAt: string;
  user: AuthUser;
}

export interface Trip {
  id: string;
  name: string;
  createdBy: string;
  inviteCode: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  members: TripMember[];
}

export interface ItineraryDay {
  destination: string;
  activities: string[];
  accommodation: string;
  cost: number;
}

export interface ConflictEntry {
  description: string;
  memberIds: string[];
}

export interface Itinerary {
  tripId: string;
  version: number;
  days: ItineraryDay[];
  totalBudget: number;
  conflictsDetected: ConflictEntry[];
  consensusScore: number;
  compromisesMade: string[];
  createdAt: string;
}

export interface PreferenceDTO {
  destinations: string[];
  availableDates: string[];
  budgetPerDay: number;
  activityTypes: string[];
  mustSee: string[];
  dealbreakers: string[];
  updatedAt: string;
}

// Keyed by userId — matches GET /api/trips/:id/preferences.
export type TripPreferencesMap = Record<string, PreferenceDTO>;

export interface VoteTallies {
  tallies: Record<string, number>;
}

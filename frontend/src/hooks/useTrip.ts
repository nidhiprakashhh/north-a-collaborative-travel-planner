import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from './useSocket';
import type { Itinerary, TripPreferencesMap, VoteTallies } from '../types/api';
import type {
  PresenceUser,
  PreferenceUpdatePayload,
  PreferenceBroadcastPayload,
  VoteTallyPayload,
  CursorBroadcastPayload,
  SynthesisStartedPayload,
  ItineraryUpdatedPayload,
  ErrorPayload,
} from '../types/socket';

export interface TripPreferenceState {
  userId: string;
  destinations: string[];
  availableDates: string[];
  budgetPerDay: number;
  activityTypes: string[];
  mustSee: string[];
  considerPlaces: string[];
  dealbreakers: string[];
  updatedAt: string;
}

export interface InitialTripState {
  preferences?: TripPreferencesMap;
  votes?: VoteTallies;
  itinerary?: Itinerary | null;
}

interface UseTripResult {
  connected: boolean;
  joined: boolean;
  presence: PresenceUser[];
  preferencesByUser: Record<string, TripPreferenceState>;
  voteTallies: Record<string, number>;
  itinerary: ItineraryUpdatedPayload | null;
  isSynthesizing: boolean;
  lastError: string | null;
  sendPreferenceUpdate: (updates: Omit<PreferenceUpdatePayload, 'tripId'>) => void;
  castVote: (destination: string) => void;
  sendCursorUpdate: (field: string) => void;
}

// High-level: consumes useSocket, joins/leaves the trip's room, and keeps
// all of that room's live state (presence, preferences, votes, itinerary)
// in React state driven entirely by the socket events from Phase 2/3.
//
// `initial` seeds state from the REST endpoints (already-existing data from
// before this session), since the socket only broadcasts changes going
// forward. Seeding never overwrites a field that a live event already
// populated, in case initial data resolves after live updates arrive.
export function useTrip(tripId: string | undefined, initial?: InitialTripState): UseTripResult {
  const { socket, connected } = useSocket();

  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [preferencesByUser, setPreferencesByUser] = useState<Record<string, TripPreferenceState>>({});
  const [voteTallies, setVoteTallies] = useState<Record<string, number>>({});
  const [itinerary, setItinerary] = useState<ItineraryUpdatedPayload | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  // Each of these three REST-backed queries resolves independently and at a
  // different time, so each gets its own "seeded for this tripId" ref —
  // gating all three behind one shared flag would mean whichever query
  // resolves after the first one silently never seeds its data.
  const seededPreferencesRef = useRef<string | undefined>(undefined);
  const seededVotesRef = useRef<string | undefined>(undefined);
  const seededItineraryRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!tripId || !initial?.preferences || seededPreferencesRef.current === tripId) {
      return;
    }
    seededPreferencesRef.current = tripId;
    const toSeed = initial.preferences;
    setPreferencesByUser((prev) => {
      const merged = { ...prev };
      for (const [userId, pref] of Object.entries(toSeed)) {
        if (!merged[userId]) {
          merged[userId] = { userId, ...pref };
        }
      }
      return merged;
    });
  }, [tripId, initial?.preferences]);

  useEffect(() => {
    if (!tripId || !initial?.votes || seededVotesRef.current === tripId) {
      return;
    }
    seededVotesRef.current = tripId;
    const tallies = initial.votes.tallies;
    setVoteTallies((prev) => (Object.keys(prev).length > 0 ? prev : tallies));
  }, [tripId, initial?.votes]);

  useEffect(() => {
    if (!tripId || initial?.itinerary === undefined || seededItineraryRef.current === tripId) {
      return;
    }
    seededItineraryRef.current = tripId;
    const seedItinerary = initial.itinerary;
    if (seedItinerary) {
      setItinerary((prev) => prev ?? seedItinerary);
    }
  }, [tripId, initial?.itinerary]);

  useEffect(() => {
    if (!socket || !connected || !tripId) {
      return undefined;
    }

    let cancelled = false;
    setJoined(false);

    // Waits for the server to confirm the room join before flipping `joined`
    // — sendPreferenceUpdate/castVote/sendCursorUpdate are gated on this, so
    // a fast interaction can't reach the server (and get broadcast to the
    // room) before this socket is actually in it.
    socket.emit('join_trip', { tripId }, (result) => {
      if (!cancelled) {
        setJoined(result.ok);
        if (!result.ok && result.error) {
          setLastError(result.error);
        }
      }
    });

    const handlePresenceState = (payload: { tripId: string; users: PresenceUser[] }) => {
      if (payload.tripId !== tripId) return;
      setPresence(payload.users);
    };
    const handleUserJoined = (payload: { tripId: string; user: PresenceUser }) => {
      if (payload.tripId !== tripId) return;
      setPresence((prev) => [...prev.filter((u) => u.userId !== payload.user.userId), payload.user]);
    };
    const handleUserLeft = (payload: { tripId: string; userId: string }) => {
      if (payload.tripId !== tripId) return;
      setPresence((prev) => prev.filter((u) => u.userId !== payload.userId));
    };
    const handlePreferenceBroadcast = (payload: PreferenceBroadcastPayload) => {
      if (payload.tripId !== tripId) return;
      setPreferencesByUser((prev) => ({
        ...prev,
        [payload.userId]: { userId: payload.userId, ...payload.preference },
      }));
    };
    const handleVoteTally = (payload: VoteTallyPayload) => {
      if (payload.tripId !== tripId) return;
      setVoteTallies(payload.tallies);
    };
    const handleCursorBroadcast = (payload: CursorBroadcastPayload) => {
      if (payload.tripId !== tripId) return;
      setPresence((prev) =>
        prev.map((u) => (u.userId === payload.userId ? { ...u, editingField: payload.field } : u)),
      );
    };
    const handleSynthesisStarted = (payload: SynthesisStartedPayload) => {
      if (payload.tripId !== tripId) return;
      setIsSynthesizing(true);
      setLastError(null);
    };
    const handleItineraryUpdated = (payload: ItineraryUpdatedPayload) => {
      if (payload.tripId !== tripId) return;
      setItinerary(payload);
      setIsSynthesizing(false);
    };
    const handleErrorMessage = (payload: ErrorPayload) => {
      setLastError(payload.message);
      setIsSynthesizing(false);
    };

    socket.on('presence_state', handlePresenceState);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
    socket.on('preference_broadcast', handlePreferenceBroadcast);
    socket.on('vote_tally_update', handleVoteTally);
    socket.on('cursor_broadcast', handleCursorBroadcast);
    socket.on('synthesis_started', handleSynthesisStarted);
    socket.on('itinerary_updated', handleItineraryUpdated);
    socket.on('error_message', handleErrorMessage);

    return () => {
      cancelled = true;
      socket.emit('leave_trip', { tripId });
      socket.off('presence_state', handlePresenceState);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      socket.off('preference_broadcast', handlePreferenceBroadcast);
      socket.off('vote_tally_update', handleVoteTally);
      socket.off('cursor_broadcast', handleCursorBroadcast);
      socket.off('synthesis_started', handleSynthesisStarted);
      socket.off('itinerary_updated', handleItineraryUpdated);
      socket.off('error_message', handleErrorMessage);

      // Reset so switching to a different trip doesn't show stale data.
      setJoined(false);
      setPresence([]);
      setPreferencesByUser({});
      setVoteTallies({});
      setItinerary(null);
      setIsSynthesizing(false);
      setLastError(null);
    };
  }, [socket, connected, tripId]);

  const sendPreferenceUpdate = useCallback(
    (updates: Omit<PreferenceUpdatePayload, 'tripId'>) => {
      if (!socket || !tripId || !joined) return;
      socket.emit('preference_update', { tripId, ...updates });
    },
    [socket, tripId, joined],
  );

  const castVote = useCallback(
    (destination: string) => {
      if (!socket || !tripId || !joined) return;
      socket.emit('vote_cast', { tripId, destination });
    },
    [socket, tripId, joined],
  );

  const sendCursorUpdate = useCallback(
    (field: string) => {
      if (!socket || !tripId || !joined) return;
      socket.emit('cursor_update', { tripId, field });
    },
    [socket, tripId, joined],
  );

  return {
    connected,
    joined,
    presence,
    preferencesByUser,
    voteTallies,
    itinerary,
    isSynthesizing,
    lastError,
    sendPreferenceUpdate,
    castVote,
    sendCursorUpdate,
  };
}

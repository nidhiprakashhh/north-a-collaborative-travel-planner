import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../hooks/useTrip';
import {
  useTripDetail,
  useInitialPreferences,
  useInitialVotes,
  useInitialItinerary,
  useInitialConsiderList,
  useSynthesize,
} from '../queries/tripQueries';
import { MemberPresence } from '../components/MemberPresence';
import { PreferenceForm } from '../components/PreferenceForm';
import { VotingPanel } from '../components/VotingPanel';
import { ConsiderBoard } from '../components/ConsiderBoard';
import { ItineraryView } from '../components/ItineraryView';
import { ConflictBanner } from '../components/ConflictBanner';

// Keyed by tripId in the default export below so this whole subtree (and
// every hook in it, including useTrip's socket room + local state) fully
// remounts on trip switch, rather than trying to reconcile state in place.
function TripRoomContent({ tripId }: { tripId: string }) {
  const { user } = useAuth();
  const { data: trip } = useTripDetail(tripId);
  const { data: initialPreferences } = useInitialPreferences(tripId);
  const { data: initialVotes } = useInitialVotes(tripId);
  const { data: initialItinerary } = useInitialItinerary(tripId);
  const { data: initialConsiderList } = useInitialConsiderList(tripId);
  const synthesize = useSynthesize(tripId);

  const {
    connected,
    joined,
    presence,
    preferencesByUser,
    voteTallies,
    itinerary,
    considerList,
    isSynthesizing,
    lastError,
    sendPreferenceUpdate,
    castVote,
    sendCursorUpdate,
    addConsiderIdea,
    removeConsiderIdea,
  } = useTrip(tripId, {
    preferences: initialPreferences,
    votes: initialVotes,
    itinerary: initialItinerary,
    considerList: initialConsiderList,
  });

  const myPreference = user ? preferencesByUser[user.id] : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/trips" className="text-xs text-slate-400 underline">
            &larr; All trips
          </Link>
          <h1 className="text-lg font-semibold text-slate-800">{trip?.name ?? 'Trip'}</h1>
          {trip && <p className="text-xs text-slate-500">Invite code: {trip.inviteCode}</p>}
        </div>
        <span className={`text-xs ${joined ? 'text-green-600' : 'text-slate-400'}`}>
          {joined ? 'connected' : connected ? 'joining trip...' : 'connecting...'}
        </span>
      </div>

      {trip && <MemberPresence members={trip.members} presence={presence} />}

      {lastError && <p className="text-sm text-red-600">{lastError}</p>}

      <ConflictBanner itinerary={itinerary} members={trip?.members ?? []} />

      <div className="grid gap-4 sm:grid-cols-2">
        <PreferenceForm initial={myPreference} onSubmit={sendPreferenceUpdate} onFocusField={sendCursorUpdate} />
        <VotingPanel preferencesByUser={preferencesByUser} voteTallies={voteTallies} onCastVote={castVote} />
      </div>

      <ConsiderBoard
        ideas={considerList}
        members={trip?.members ?? []}
        onAdd={addConsiderIdea}
        onRemove={removeConsiderIdea}
      />

      <ItineraryView
        itinerary={itinerary}
        isSynthesizing={isSynthesizing}
        onRegenerate={() => synthesize.mutate()}
        regenerateDisabled={Object.keys(preferencesByUser).length === 0}
      />
    </div>
  );
}

export function TripRoomPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return <TripRoomContent key={id} tripId={id} />;
}

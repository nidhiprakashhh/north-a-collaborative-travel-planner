import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTripsList, useCreateTrip, useJoinTrip } from '../queries/tripQueries';
import { ApiError } from '../lib/apiClient';

export function TripsListPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data: trips, isLoading } = useTripsList();
  const createTrip = useCreateTrip();
  const joinTrip = useJoinTrip();

  const [newTripName, setNewTripName] = useState('');
  const [newTripStartDate, setNewTripStartDate] = useState('');
  const [newTripEndDate, setNewTripEndDate] = useState('');
  const [joinTripId, setJoinTripId] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const trip = await createTrip.mutateAsync({
        name: newTripName,
        startDate: newTripStartDate || undefined,
        endDate: newTripEndDate || undefined,
      });
      setNewTripName('');
      setNewTripStartDate('');
      setNewTripEndDate('');
      navigate(`/trips/${trip.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create trip');
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const trip = await joinTrip.mutateAsync({ tripId: joinTripId, inviteCode: joinInviteCode });
      setJoinTripId('');
      setJoinInviteCode('');
      navigate(`/trips/${trip.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to join trip');
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Your trips</h1>
        <div className="flex items-center gap-3 text-sm text-ink-soft">
          <span>{user?.name}</span>
          <button onClick={logout} className="text-ink-faint underline hover:text-sky">
            Log out
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <form onSubmit={handleCreate} className="space-y-2 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-ink">Create a trip</h2>
          <input
            className="w-full rounded-lg border border-haze-200 bg-white px-2 py-1.5 text-sm focus:border-sky focus:outline-none"
            placeholder="Trip name"
            value={newTripName}
            onChange={(e) => setNewTripName(e.target.value)}
            required
          />
          <div className="flex gap-2">
            {/* min-w-0 overrides flex items' default min-width:auto — without
                it, a date input's intrinsic content width (its internal
                dd/mm/yyyy fields + calendar icon) refuses to shrink below
                that size, so it overflows flex-1's w-full instead of
                respecting it. */}
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-sm font-medium text-ink-soft">Start date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-haze-200 bg-white px-2 py-1.5 text-sm focus:border-sky focus:outline-none"
                value={newTripStartDate}
                onChange={(e) => setNewTripStartDate(e.target.value)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-sm font-medium text-ink-soft">End date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-haze-200 bg-white px-2 py-1.5 text-sm focus:border-sky focus:outline-none"
                value={newTripEndDate}
                min={newTripStartDate || undefined}
                onChange={(e) => setNewTripEndDate(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={createTrip.isPending}
            className="rounded-lg bg-sky px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-dark disabled:opacity-40"
          >
            Create
          </button>
        </form>

        <form onSubmit={handleJoin} className="space-y-2 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-ink">Join a trip</h2>
          <input
            className="w-full rounded-lg border border-haze-200 bg-white px-2 py-1.5 text-sm focus:border-sky focus:outline-none"
            placeholder="Trip ID"
            value={joinTripId}
            onChange={(e) => setJoinTripId(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-haze-200 bg-white px-2 py-1.5 text-sm focus:border-sky focus:outline-none"
            placeholder="Invite code"
            value={joinInviteCode}
            onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())}
            required
          />
          <button
            type="submit"
            disabled={joinTrip.isPending}
            className="rounded-lg bg-sky px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sky-dark disabled:opacity-40"
          >
            Join
          </button>
        </form>
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-ink-soft">Loading...</p>}
        {trips?.length === 0 && <p className="text-sm text-ink-soft">No trips yet, create one above.</p>}
        {trips?.map((trip) => (
          <button
            key={trip.id}
            onClick={() => navigate(`/trips/${trip.id}`)}
            className="block w-full rounded-xl bg-white p-4 text-left shadow-sm transition hover:shadow-md"
          >
            <div className="font-display text-base font-semibold text-ink">{trip.name}</div>
            <div className="text-xs text-ink-soft">
              {trip.members.length} member{trip.members.length === 1 ? '' : 's'} &middot; invite code{' '}
              {trip.inviteCode}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

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
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-800">Your trips</h1>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>{user?.name}</span>
          <button onClick={logout} className="text-slate-400 underline">
            Log out
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <form onSubmit={handleCreate} className="space-y-2 rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Create a trip</h2>
          <input
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            placeholder="Trip name"
            value={newTripName}
            onChange={(e) => setNewTripName(e.target.value)}
            required
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">Start date</label>
              <input
                type="date"
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={newTripStartDate}
                onChange={(e) => setNewTripStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500">End date</label>
              <input
                type="date"
                className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                value={newTripEndDate}
                min={newTripStartDate || undefined}
                onChange={(e) => setNewTripEndDate(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={createTrip.isPending}
            className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            Create
          </button>
        </form>

        <form onSubmit={handleJoin} className="space-y-2 rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Join a trip</h2>
          <input
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            placeholder="Trip ID"
            value={joinTripId}
            onChange={(e) => setJoinTripId(e.target.value)}
            required
          />
          <input
            className="w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
            placeholder="Invite code"
            value={joinInviteCode}
            onChange={(e) => setJoinInviteCode(e.target.value.toUpperCase())}
            required
          />
          <button
            type="submit"
            disabled={joinTrip.isPending}
            className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            Join
          </button>
        </form>
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-slate-500">Loading...</p>}
        {trips?.length === 0 && <p className="text-sm text-slate-500">No trips yet — create one above.</p>}
        {trips?.map((trip) => (
          <button
            key={trip.id}
            onClick={() => navigate(`/trips/${trip.id}`)}
            className="block w-full rounded-lg bg-white p-4 text-left shadow-sm hover:bg-slate-50"
          >
            <div className="font-medium text-slate-800">{trip.name}</div>
            <div className="text-xs text-slate-500">
              {trip.members.length} member{trip.members.length === 1 ? '' : 's'} &middot; invite code{' '}
              {trip.inviteCode}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as tripsApi from '../api/tripsApi';
import { useAuth } from '../context/AuthContext';
import type { Trip } from '../types/api';

export function useTripsList() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['trips'],
    queryFn: () => tripsApi.listTrips(token!),
    enabled: Boolean(token),
  });
}

export function useTripDetail(tripId: string | undefined) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['trips', tripId],
    queryFn: () => tripsApi.getTrip(token!, tripId!),
    enabled: Boolean(token) && Boolean(tripId),
  });
}

export function useCreateTrip() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; startDate?: string; endDate?: string }) =>
      tripsApi.createTrip(token!, input),
    onSuccess: (trip: Trip) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.setQueryData(['trips', trip.id], trip);
    },
  });
}

export function useJoinTrip() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, inviteCode }: { tripId: string; inviteCode: string }) =>
      tripsApi.joinTrip(token!, tripId, inviteCode),
    onSuccess: (trip: Trip) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.setQueryData(['trips', trip.id], trip);
    },
  });
}

export function useSynthesize(tripId: string) {
  const { token } = useAuth();
  return useMutation({
    mutationFn: () => tripsApi.synthesize(token!, tripId),
  });
}

// These three seed initial state on page load — the socket layer only
// broadcasts changes going forward, not what's already in the database.
export function useInitialPreferences(tripId: string | undefined) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['trips', tripId, 'preferences'],
    queryFn: () => tripsApi.getPreferences(token!, tripId!),
    enabled: Boolean(token) && Boolean(tripId),
  });
}

export function useInitialVotes(tripId: string | undefined) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['trips', tripId, 'votes'],
    queryFn: () => tripsApi.getVotes(token!, tripId!),
    enabled: Boolean(token) && Boolean(tripId),
  });
}

export function useInitialItinerary(tripId: string | undefined) {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['trips', tripId, 'itinerary'],
    queryFn: () => tripsApi.getItinerary(token!, tripId!),
    enabled: Boolean(token) && Boolean(tripId),
  });
}

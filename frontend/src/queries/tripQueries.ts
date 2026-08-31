import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as tripsApi from '../api/tripsApi';
import { useAuth } from '../context/AuthContext';
import type { Trip } from '../types/api';

export function useTripsList() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['trips'],
    queryFn: () => tripsApi.listTrips(),
    enabled: isAuthenticated,
  });
}

export function useTripDetail(tripId: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['trips', tripId],
    queryFn: () => tripsApi.getTrip(tripId!),
    enabled: isAuthenticated && Boolean(tripId),
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; startDate?: string; endDate?: string }) => tripsApi.createTrip(input),
    onSuccess: (trip: Trip) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.setQueryData(['trips', trip.id], trip);
    },
  });
}

export function useJoinTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, inviteCode }: { tripId: string; inviteCode: string }) =>
      tripsApi.joinTrip(tripId, inviteCode),
    onSuccess: (trip: Trip) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.setQueryData(['trips', trip.id], trip);
    },
  });
}

export function useSynthesize(tripId: string) {
  return useMutation({
    mutationFn: () => tripsApi.synthesize(tripId),
  });
}

// These three seed initial state on page load — the socket layer only
// broadcasts changes going forward, not what's already in the database.
export function useInitialPreferences(tripId: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['trips', tripId, 'preferences'],
    queryFn: () => tripsApi.getPreferences(tripId!),
    enabled: isAuthenticated && Boolean(tripId),
  });
}

export function useInitialVotes(tripId: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['trips', tripId, 'votes'],
    queryFn: () => tripsApi.getVotes(tripId!),
    enabled: isAuthenticated && Boolean(tripId),
  });
}

export function useInitialItinerary(tripId: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['trips', tripId, 'itinerary'],
    queryFn: () => tripsApi.getItinerary(tripId!),
    enabled: isAuthenticated && Boolean(tripId),
  });
}

export function useInitialConsiderList(tripId: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['trips', tripId, 'consider'],
    queryFn: () => tripsApi.getConsiderList(tripId!),
    enabled: isAuthenticated && Boolean(tripId),
  });
}

export function useInitialCosts(tripId: string | undefined) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: ['trips', tripId, 'costs'],
    queryFn: () => tripsApi.getCosts(tripId!),
    enabled: isAuthenticated && Boolean(tripId),
  });
}

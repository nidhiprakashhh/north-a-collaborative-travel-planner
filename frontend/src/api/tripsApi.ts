import { apiRequest } from '../lib/apiClient';
import type { Trip, Itinerary, TripPreferencesMap, VoteTallies } from '../types/api';

export function listTrips(): Promise<Trip[]> {
  return apiRequest<Trip[]>('/api/trips');
}

export function getTrip(tripId: string): Promise<Trip> {
  return apiRequest<Trip>(`/api/trips/${tripId}`);
}

export function createTrip(input: { name: string; startDate?: string; endDate?: string }): Promise<Trip> {
  return apiRequest<Trip>('/api/trips', { method: 'POST', body: input });
}

export function joinTrip(tripId: string, inviteCode: string): Promise<Trip> {
  return apiRequest<Trip>(`/api/trips/${tripId}/join`, {
    method: 'POST',
    body: { inviteCode },
  });
}

export function synthesize(tripId: string): Promise<Itinerary> {
  return apiRequest<Itinerary>(`/api/trips/${tripId}/synthesize`, { method: 'POST' });
}

export function getPreferences(tripId: string): Promise<TripPreferencesMap> {
  return apiRequest<TripPreferencesMap>(`/api/trips/${tripId}/preferences`);
}

export function getVotes(tripId: string): Promise<VoteTallies> {
  return apiRequest<VoteTallies>(`/api/trips/${tripId}/votes`);
}

export function getItinerary(tripId: string): Promise<Itinerary | null> {
  return apiRequest<Itinerary | null>(`/api/trips/${tripId}/itinerary`);
}

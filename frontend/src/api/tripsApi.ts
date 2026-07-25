import { apiRequest } from '../lib/apiClient';
import type { Trip, Itinerary, TripPreferencesMap, VoteTallies } from '../types/api';

export function listTrips(token: string): Promise<Trip[]> {
  return apiRequest<Trip[]>('/api/trips', { token });
}

export function getTrip(token: string, tripId: string): Promise<Trip> {
  return apiRequest<Trip>(`/api/trips/${tripId}`, { token });
}

export function createTrip(
  token: string,
  input: { name: string; startDate?: string; endDate?: string },
): Promise<Trip> {
  return apiRequest<Trip>('/api/trips', { method: 'POST', token, body: input });
}

export function joinTrip(token: string, tripId: string, inviteCode: string): Promise<Trip> {
  return apiRequest<Trip>(`/api/trips/${tripId}/join`, {
    method: 'POST',
    token,
    body: { inviteCode },
  });
}

export function synthesize(token: string, tripId: string): Promise<Itinerary> {
  return apiRequest<Itinerary>(`/api/trips/${tripId}/synthesize`, { method: 'POST', token });
}

export function getPreferences(token: string, tripId: string): Promise<TripPreferencesMap> {
  return apiRequest<TripPreferencesMap>(`/api/trips/${tripId}/preferences`, { token });
}

export function getVotes(token: string, tripId: string): Promise<VoteTallies> {
  return apiRequest<VoteTallies>(`/api/trips/${tripId}/votes`, { token });
}

export function getItinerary(token: string, tripId: string): Promise<Itinerary | null> {
  return apiRequest<Itinerary | null>(`/api/trips/${tripId}/itinerary`, { token });
}

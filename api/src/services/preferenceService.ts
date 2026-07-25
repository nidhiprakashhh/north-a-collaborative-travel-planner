import { Preference } from '../models/Preference';

export interface PreferenceDTO {
  destinations: string[];
  availableDates: string[];
  budgetPerDay: number;
  activityTypes: string[];
  mustSee: string[];
  dealbreakers: string[];
  updatedAt: Date;
}

// Keyed by userId — this is exactly the shape the frontend needs to seed
// PreferenceForm/VotingPanel on initial load, since the socket layer only
// broadcasts changes going forward, not existing state.
export async function getTripPreferences(tripId: string): Promise<Record<string, PreferenceDTO>> {
  const preferences = await Preference.find({ tripId });

  return Object.fromEntries(
    preferences.map((p) => [
      p.userId,
      {
        destinations: p.destinations,
        availableDates: p.availableDates,
        budgetPerDay: p.budgetPerDay,
        activityTypes: p.activityTypes,
        mustSee: p.mustSee,
        dealbreakers: p.dealbreakers,
        updatedAt: p.updatedAt,
      },
    ]),
  );
}

import { Schema, model, Document } from 'mongoose';

export interface IPreference extends Document {
  tripId: string;
  userId: string;
  destinations: string[];
  availableDates: string[];
  budgetPerDay: number;
  activityTypes: string[];
  mustSee: string[];
  // Loose ideas a member wants the group to consider — "saw this on
  // Instagram, might be cool" — distinct from mustSee: nothing here is a
  // hard requirement, no guardrail enforces it appears, and synthesis is
  // free to leave any of it out with no explanation needed. Optional by
  // design; an empty list changes nothing about today's behavior.
  considerPlaces: string[];
  dealbreakers: string[];
  updatedAt: Date;
}

const preferenceSchema = new Schema<IPreference>(
  {
    tripId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    destinations: { type: [String], default: [] },
    availableDates: { type: [String], default: [] },
    budgetPerDay: { type: Number, default: 0 },
    activityTypes: { type: [String], default: [] },
    mustSee: { type: [String], default: [] },
    considerPlaces: { type: [String], default: [] },
    dealbreakers: { type: [String], default: [] },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

// One preferences document per user per trip — later phases upsert against this.
preferenceSchema.index({ tripId: 1, userId: 1 }, { unique: true });

export const Preference = model<IPreference>('Preference', preferenceSchema);

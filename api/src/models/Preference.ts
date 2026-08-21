import { Schema, model, Document } from 'mongoose';

export interface IPreference extends Document {
  tripId: string;
  userId: string;
  destinations: string[];
  availableDates: string[];
  budgetPerDay: number;
  activityTypes: string[];
  mustSee: string[];
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
    dealbreakers: { type: [String], default: [] },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

// One preferences document per user per trip — later phases upsert against this.
preferenceSchema.index({ tripId: 1, userId: 1 }, { unique: true });

export const Preference = model<IPreference>('Preference', preferenceSchema);

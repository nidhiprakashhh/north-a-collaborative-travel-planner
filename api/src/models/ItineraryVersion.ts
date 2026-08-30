import { Schema, model, Document } from 'mongoose';

export interface ItineraryDay {
  destination: string;
  activities: string[];
  accommodation: string;
  cost: number;
}

// memberIds attributes a conflict to the specific member(s) whose preference
// caused it, so the frontend can say *whose* dealbreaker/must-see is at
// stake instead of showing an unattributed sentence.
export interface ConflictEntry {
  description: string;
  memberIds: string[];
}

export interface IItineraryVersion extends Document {
  tripId: string;
  version: number;
  days: ItineraryDay[];
  totalBudget: number;
  conflictsDetected: ConflictEntry[];
  consensusScore: number;
  compromisesMade: string[];
  // Set only when this version was a manual field edit, not an LLM
  // synthesis run — lets the frontend show "edited by X" vs. an
  // AI-generated version, and is otherwise inert (synthesisService.ts's
  // "current draft" read treats the latest version as the draft to revise
  // regardless of which kind it is, deliberately no special-casing).
  editedBy?: string;
  createdAt: Date;
}

const itineraryDaySchema = new Schema<ItineraryDay>(
  {
    destination: { type: String, required: true },
    activities: { type: [String], default: [] },
    accommodation: { type: String, default: '' },
    cost: { type: Number, default: 0 },
  },
  { _id: false },
);

const conflictEntrySchema = new Schema<ConflictEntry>(
  {
    description: { type: String, required: true },
    memberIds: { type: [String], default: [] },
  },
  { _id: false },
);

const itineraryVersionSchema = new Schema<IItineraryVersion>(
  {
    tripId: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    days: { type: [itineraryDaySchema], default: [] },
    totalBudget: { type: Number, default: 0 },
    conflictsDetected: { type: [conflictEntrySchema], default: [] },
    consensusScore: { type: Number, default: 0 },
    compromisesMade: { type: [String], default: [] },
    editedBy: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Append-only: every synthesis run is a new version, none are overwritten,
// so a trip's itinerary history is fully preserved and replayable.
itineraryVersionSchema.index({ tripId: 1, version: 1 }, { unique: true });

export const ItineraryVersion = model<IItineraryVersion>('ItineraryVersion', itineraryVersionSchema);

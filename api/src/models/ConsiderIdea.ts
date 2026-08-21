import { Schema, model, Document } from 'mongoose';

// A shared, trip-wide list — not per-member, unlike Preference. Anyone saw
// something ("a matcha café on Instagram") and wants the group to see it
// and maybe the itinerary to use it, without it being a requirement the
// way mustSee is. Deliberately minimal: no category, no cost — just a name
// anyone can type, optionally with a link for the group's own reference.
export interface IConsiderIdea extends Document {
  tripId: string;
  name: string;
  link?: string;
  addedBy: string;
  createdAt: Date;
}

const considerIdeaSchema = new Schema<IConsiderIdea>(
  {
    tripId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    link: { type: String },
    addedBy: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ConsiderIdea = model<IConsiderIdea>('ConsiderIdea', considerIdeaSchema);

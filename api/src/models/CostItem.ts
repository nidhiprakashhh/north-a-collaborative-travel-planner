import { Schema, model, Document } from 'mongoose';

// A shared, trip-wide list of real costs members actually log — flights
// booked, hotels reserved, a dinner that already happened — as opposed to
// the itinerary's per-day "cost" field, which is still just the LLM's
// estimate. This is deliberately the same shape/pattern as ConsiderIdea
// (shared, discrete per-item documents, not per-member data): the group
// adds line items live, the running total is a real sum, not a guess.
export type CostCategory = 'flight' | 'lodging' | 'food' | 'activity' | 'transport' | 'other';

export const COST_CATEGORIES: CostCategory[] = ['flight', 'lodging', 'food', 'activity', 'transport', 'other'];

export interface ICostItem extends Document {
  tripId: string;
  label: string;
  amount: number;
  category: CostCategory;
  addedBy: string;
  createdAt: Date;
}

const costItemSchema = new Schema<ICostItem>(
  {
    tripId: { type: String, required: true, index: true },
    label: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, enum: COST_CATEGORIES, default: 'other' },
    addedBy: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const CostItem = model<ICostItem>('CostItem', costItemSchema);

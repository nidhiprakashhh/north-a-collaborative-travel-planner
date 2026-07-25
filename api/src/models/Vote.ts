import { Schema, model, Document } from 'mongoose';

export interface IVote extends Document {
  tripId: string;
  userId: string;
  destination: string;
  updatedAt: Date;
}

const voteSchema = new Schema<IVote>(
  {
    tripId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    destination: { type: String, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

// One active vote per user per trip — casting a new vote replaces the old one.
voteSchema.index({ tripId: 1, userId: 1 }, { unique: true });

export const Vote = model<IVote>('Vote', voteSchema);

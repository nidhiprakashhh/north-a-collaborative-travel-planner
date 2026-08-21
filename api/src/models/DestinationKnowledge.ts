import { Schema, model, Document } from 'mongoose';

// Cached, real facts about a destination (real named attractions/activities/
// food, sourced from Wikivoyage) fed into the synthesis prompt as grounding
// so the LLM organizes real places instead of recalling — and sometimes
// misplacing — them from its own fuzzy memory. Persisted in Mongo (not an
// in-memory cache like geocodingService.ts's) since the payload is real text
// worth surviving a restart, not just a pair of coordinates.
export interface IDestinationKnowledge extends Document {
  name: string;
  facts: string;
  source: string;
  fetchedAt: Date;
}

const destinationKnowledgeSchema = new Schema<IDestinationKnowledge>({
  name: { type: String, required: true, unique: true },
  facts: { type: String, required: true },
  source: { type: String, required: true },
  fetchedAt: { type: Date, required: true },
});

export const DestinationKnowledge = model<IDestinationKnowledge>(
  'DestinationKnowledge',
  destinationKnowledgeSchema,
);

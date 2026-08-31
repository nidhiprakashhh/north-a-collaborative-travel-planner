import { CostItem, CostCategory } from '../models/CostItem';

export interface CostItemDTO {
  id: string;
  label: string;
  amount: number;
  category: CostCategory;
  addedBy: string;
  createdAt: Date;
}

function toDTO(item: InstanceType<typeof CostItem>): CostItemDTO {
  return {
    id: item.id,
    label: item.label,
    amount: item.amount,
    category: item.category,
    addedBy: item.addedBy,
    createdAt: item.createdAt,
  };
}

// Seeds the shared board on initial page load — the socket layer only
// broadcasts cost_added/cost_removed going forward.
export async function getCostItems(tripId: string): Promise<CostItemDTO[]> {
  const items = await CostItem.find({ tripId }).sort({ createdAt: 1 });
  return items.map(toDTO);
}

// The real total, a plain sum of what members actually logged — used both
// by the frontend (shown next to the itinerary's LLM-estimated totalBudget,
// clearly labeled as a different thing) and, later, as grounding context if
// synthesis starts referencing real costs instead of only guessing them.
export async function getCostTotal(tripId: string): Promise<number> {
  const items = await CostItem.find({ tripId }, { amount: 1 });
  return items.reduce((sum, item) => sum + item.amount, 0);
}

import { ConsiderIdea } from '../models/ConsiderIdea';

export interface ConsiderIdeaDTO {
  id: string;
  name: string;
  link?: string;
  addedBy: string;
  createdAt: Date;
}

function toDTO(idea: InstanceType<typeof ConsiderIdea>): ConsiderIdeaDTO {
  return {
    id: idea.id,
    name: idea.name,
    link: idea.link,
    addedBy: idea.addedBy,
    createdAt: idea.createdAt,
  };
}

// Seeds the shared board on initial page load — the socket layer only
// broadcasts consider_added/consider_removed going forward.
export async function getConsiderIdeas(tripId: string): Promise<ConsiderIdeaDTO[]> {
  const ideas = await ConsiderIdea.find({ tripId }).sort({ createdAt: 1 });
  return ideas.map(toDTO);
}

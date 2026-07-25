import { Request, Response } from 'express';
import { createTrip, getTripById, joinTrip, listUserTrips } from '../services/tripService';
import { synthesizeItinerary, getLatestItinerary } from '../services/synthesisService';
import { getTripPreferences } from '../services/preferenceService';
import { computeVoteTallies } from '../services/voteService';
import { HttpError } from '../utils/httpError';
import { AppServer } from '../socket/types';

function handleError(err: unknown, res: Response, fallbackMessage: string): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error(`[trips] ${fallbackMessage}`, err);
  res.status(500).json({ error: fallbackMessage });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { name, startDate, endDate } = req.body as { name?: string; startDate?: string; endDate?: string };

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  try {
    const trip = await createTrip(req.userId!, { name, startDate, endDate });
    res.status(201).json(trip);
  } catch (err) {
    handleError(err, res, 'Failed to create trip');
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const trip = await getTripById(req.userId!, req.params.id);
    res.status(200).json(trip);
  } catch (err) {
    handleError(err, res, 'Failed to fetch trip');
  }
}

export async function join(req: Request, res: Response): Promise<void> {
  const { inviteCode } = req.body as { inviteCode?: string };

  if (!inviteCode) {
    res.status(400).json({ error: 'inviteCode is required' });
    return;
  }

  try {
    const trip = await joinTrip(req.userId!, req.params.id, inviteCode.toUpperCase());
    res.status(200).json(trip);
  } catch (err) {
    handleError(err, res, 'Failed to join trip');
  }
}

export async function listMine(req: Request, res: Response): Promise<void> {
  try {
    const trips = await listUserTrips(req.userId!);
    res.status(200).json(trips);
  } catch (err) {
    handleError(err, res, 'Failed to list trips');
  }
}

export async function getPreferences(req: Request, res: Response): Promise<void> {
  try {
    await getTripById(req.userId!, req.params.id);
    const preferences = await getTripPreferences(req.params.id);
    res.status(200).json(preferences);
  } catch (err) {
    handleError(err, res, 'Failed to fetch preferences');
  }
}

export async function getVotes(req: Request, res: Response): Promise<void> {
  try {
    await getTripById(req.userId!, req.params.id);
    const tallies = await computeVoteTallies(req.params.id);
    res.status(200).json({ tallies });
  } catch (err) {
    handleError(err, res, 'Failed to fetch votes');
  }
}

export async function getItinerary(req: Request, res: Response): Promise<void> {
  try {
    await getTripById(req.userId!, req.params.id);
    const itinerary = await getLatestItinerary(req.params.id);
    res.status(200).json(itinerary);
  } catch (err) {
    handleError(err, res, 'Failed to fetch itinerary');
  }
}

export async function synthesize(req: Request, res: Response): Promise<void> {
  const tripId = req.params.id;

  try {
    // Confirms membership (and that the trip exists) before spending an LLM call.
    await getTripById(req.userId!, tripId);

    const io = req.app.get('io') as AppServer | undefined;
    // Emitted before the LLM call so every connected client (including ones
    // that didn't trigger this request) can show a "synthesizing..." state.
    io?.to(tripId).emit('synthesis_started', { tripId });

    const itinerary = await synthesizeItinerary(tripId);
    io?.to(tripId).emit('itinerary_updated', itinerary);

    res.status(200).json(itinerary);
  } catch (err) {
    handleError(err, res, 'Failed to synthesize itinerary');
  }
}

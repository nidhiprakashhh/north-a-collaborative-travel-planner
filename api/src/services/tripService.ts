import { Prisma } from '@prisma/client';
import { prisma } from '../db/postgres';
import { generateInviteCode } from '../utils/inviteCode';
import { HttpError } from '../utils/httpError';

const MAX_INVITE_CODE_ATTEMPTS = 5;

const tripWithMembers = {
  include: {
    members: {
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    },
  },
} satisfies Prisma.TripDefaultArgs;

export type TripWithMembers = Prisma.TripGetPayload<typeof tripWithMembers>;

export interface CreateTripInput {
  name: string;
  startDate?: string;
  endDate?: string;
}

export async function createTrip(userId: string, input: CreateTripInput): Promise<TripWithMembers> {
  // Invite codes are generated client-side and only enforced unique by the
  // DB constraint, so collisions are handled by retrying with a fresh code
  // rather than checking existence first (avoids a race between check and insert).
  for (let attempt = 1; attempt <= MAX_INVITE_CODE_ATTEMPTS; attempt++) {
    const inviteCode = generateInviteCode();
    try {
      return await prisma.$transaction(async (tx) => {
        const trip = await tx.trip.create({
          data: {
            name: input.name,
            createdBy: userId,
            inviteCode,
            startDate: input.startDate ? new Date(input.startDate) : undefined,
            endDate: input.endDate ? new Date(input.endDate) : undefined,
          },
        });

        await tx.tripMember.create({
          data: { tripId: trip.id, userId, role: 'owner' },
        });

        return tx.trip.findUniqueOrThrow({ where: { id: trip.id }, ...tripWithMembers });
      });
    } catch (err) {
      const isInviteCodeCollision =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        (err.meta?.target as string[] | undefined)?.includes('inviteCode');

      if (!isInviteCodeCollision || attempt === MAX_INVITE_CODE_ATTEMPTS) {
        throw err;
      }
      // otherwise loop and try a new code
    }
  }

  throw new HttpError(500, 'Failed to generate a unique invite code');
}

export async function getTripById(userId: string, tripId: string): Promise<TripWithMembers> {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, ...tripWithMembers });
  if (!trip) {
    throw new HttpError(404, 'Trip not found');
  }

  const isMember = trip.members.some((member) => member.userId === userId);
  if (!isMember) {
    throw new HttpError(403, 'You are not a member of this trip');
  }

  return trip;
}

export async function joinTrip(userId: string, tripId: string, inviteCode: string): Promise<TripWithMembers> {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, ...tripWithMembers });
  if (!trip) {
    throw new HttpError(404, 'Trip not found');
  }

  if (trip.inviteCode !== inviteCode) {
    throw new HttpError(400, 'Invalid invite code');
  }

  const alreadyMember = trip.members.some((member) => member.userId === userId);
  if (alreadyMember) {
    throw new HttpError(409, 'You are already a member of this trip');
  }

  await prisma.tripMember.create({ data: { tripId, userId, role: 'member' } });

  return prisma.trip.findUniqueOrThrow({ where: { id: tripId }, ...tripWithMembers });
}

export async function listUserTrips(userId: string): Promise<TripWithMembers[]> {
  const memberships = await prisma.tripMember.findMany({
    where: { userId },
    include: { trip: tripWithMembers },
  });

  return memberships.map((membership) => membership.trip);
}

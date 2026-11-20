// src/services/access.ts  (کنترل مالکیت؛ هر callback باید از این رد بشه)
import { prisma } from "@/db/client";

export const getOwnedGroup = (userId: number, groupId: number) =>
  prisma.group.findFirst({
    where: { id: groupId, ownerId: userId },
    include: { members: { orderBy: { id: "asc" } } },
  });

export const getOwnedTrip = (userId: number, tripId: number) =>
  prisma.trip.findFirst({
    where: { id: tripId, group: { ownerId: userId } },
    include: { group: { include: { members: { orderBy: { id: "asc" } } } } },
  });
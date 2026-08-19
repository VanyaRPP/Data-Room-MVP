import { Injectable } from '@nestjs/common';
import type { RoomDto } from '@dataroom/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The MVP gives each user exactly one room, but the API is a collection from
   * the start: multiple rooms per user is the natural next step, and changing
   * the shape later would break every client.
   */
  async listForUser(userId: string): Promise<RoomDto[]> {
    const rooms = await this.prisma.dataRoom.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    });

    return rooms.map((room) => {
      if (!room.rootNodeId) {
        // Set in the same transaction that creates the room (AuthService
        // .register), so this can only mean the row was written some other way.
        throw new Error(`Data room ${room.id} has no root node`);
      }

      return { id: room.id, name: room.name, rootNodeId: room.rootNodeId };
    });
  }
}

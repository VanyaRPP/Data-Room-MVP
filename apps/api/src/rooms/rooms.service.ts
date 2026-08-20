import { Injectable, NotFoundException } from '@nestjs/common';
import type { DataRoom } from '@prisma/client';
import type { RenameRoomInput, RoomDto } from '@dataroom/shared';
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

    return rooms.map(toRoomDto);
  }

  /**
   * Renames the room, and its root folder with it.
   *
   * They are one thing to anyone using this - the top of every trail - but two
   * rows underneath, created with the same name and updated together here. The
   * root node cannot be renamed through the node endpoint (it is structural,
   * see requireParentId); this is the only door, and it moves both so the two
   * can never disagree.
   */
  async rename(
    roomId: string,
    userId: string,
    input: RenameRoomInput,
  ): Promise<RoomDto> {
    // Scoped by owner rather than checked afterwards, so a room belonging to
    // someone else is indistinguishable from one that does not exist.
    const room = await this.prisma.dataRoom.findFirst({
      where: { id: roomId, ownerId: userId },
    });
    if (!room) throw new NotFoundException('Data room not found');

    const renamed = await this.prisma.$transaction(async (tx) => {
      if (room.rootNodeId) {
        await tx.node.update({
          where: { id: room.rootNodeId },
          data: { name: input.name },
        });
      }

      return tx.dataRoom.update({
        where: { id: roomId },
        data: { name: input.name },
      });
    });

    return toRoomDto(renamed);
  }
}

function toRoomDto(room: DataRoom): RoomDto {
  if (!room.rootNodeId) {
    // Set in the same transaction that creates the room (AuthService.register),
    // so this can only mean the row was written some other way.
    throw new Error(`Data room ${room.id} has no root node`);
  }

  return { id: room.id, name: room.name, rootNodeId: room.rootNodeId };
}

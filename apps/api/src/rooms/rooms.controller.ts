import { Controller, Get } from '@nestjs/common';
import type { RoomDto } from '@dataroom/shared';
import { CurrentUser, type RequestUser } from '../auth/decorators';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser): Promise<RoomDto[]> {
    return this.roomsService.listForUser(user.id);
  }
}

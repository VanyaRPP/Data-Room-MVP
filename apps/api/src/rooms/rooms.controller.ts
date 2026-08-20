import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { roomDtoSchema, type RoomDto } from '@dataroom/shared';
import { ApiZodArrayResponse } from '../common/api-docs';
import { CurrentUser, type RequestUser } from '../auth/decorators';
import { RoomsService } from './rooms.service';

@ApiTags('Rooms')
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({
    summary: "The signed-in user's data rooms",
    description:
      'The MVP gives each user exactly one, but the API is a collection so ' +
      'that adding more never changes its shape. Start from `rootNodeId`.',
  })
  @ApiZodArrayResponse(200, roomDtoSchema, 'Rooms owned by this user')
  list(@CurrentUser() user: RequestUser): Promise<RoomDto[]> {
    return this.roomsService.listForUser(user.id);
  }
}

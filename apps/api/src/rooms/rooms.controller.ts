import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  apiErrorShape,
  renameRoomSchema,
  roomDtoSchema,
  type RenameRoomInput,
  type RoomDto,
} from '@dataroom/shared';
import {
  ApiZodArrayResponse,
  ApiZodBody,
  ApiZodResponse,
} from '../common/api-docs';
import { zodPipe } from '../common/zod-validation.pipe';
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

  @Patch(':id')
  @ApiParam({ name: 'id', format: 'uuid', description: 'Data room id' })
  @ApiOperation({
    summary: 'Rename a data room',
    description:
      'Renames the room, not its root folder - that node is structural and ' +
      'answers 400 to a rename. A room owned by someone else answers 404.',
  })
  @ApiZodBody(renameRoomSchema)
  @ApiZodResponse(200, roomDtoSchema, 'The renamed room')
  @ApiZodResponse(404, apiErrorShape, 'No such room, or not yours')
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(renameRoomSchema)) body: RenameRoomInput,
    @CurrentUser() user: RequestUser,
  ): Promise<RoomDto> {
    return this.roomsService.rename(id, user.id, body);
  }
}

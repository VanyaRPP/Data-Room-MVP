import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createShareSchema,
  shareDtoSchema,
  sharedByMeItemSchema,
  sharedWithMeItemSchema,
  sharesQuerySchema,
  type CreateShareInput,
  type ShareDto,
  type SharedByMeItem,
  type SharedWithMeItem,
  type SharesQuery,
} from '@dataroom/shared';
import {
  ApiZodArrayResponse,
  ApiZodBody,
  ApiZodQuery,
  ApiZodResponse,
} from '../common/api-docs';
import { zodPipe } from '../common/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../auth/decorators';
import { SharesService } from './shares.service';

@ApiTags('Sharing')
@Controller()
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post('shares')
  @ApiOperation({
    summary: 'Share a room, folder or file, or extend an existing share',
    description:
      'A node has at most one active share per mode. Turning a public link on ' +
      'twice returns the same link rather than invalidating the one already ' +
      'circulating, and adding people to a restricted share adds grants to it. ' +
      'Grants are by email address, so someone can be given access before ' +
      'they have an account. Recipients get read-only access, including to ' +
      'everything nested beneath a folder or room.',
  })
  @ApiZodBody(createShareSchema)
  @ApiZodResponse(201, shareDtoSchema, 'The share, with its grants')
  create(
    @Body(zodPipe(createShareSchema)) body: CreateShareInput,
    @CurrentUser() user: RequestUser,
  ): Promise<ShareDto> {
    return this.sharesService.create(body, user.id);
  }

  @Get('shares')
  @ApiOperation({ summary: 'Active shares on a node, for its owner' })
  @ApiZodQuery(sharesQuerySchema)
  @ApiZodArrayResponse(200, shareDtoSchema, 'Active shares')
  list(
    @Query(zodPipe(sharesQuerySchema)) query: SharesQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<ShareDto[]> {
    return this.sharesService.listForNode(query.nodeId, user.id);
  }

  @Post('shares/:id/revoke')
  @ApiOperation({
    summary: 'Revoke a share',
    description:
      'Recorded as a timestamp rather than a delete, so the fact that the ' +
      'link existed and when access ended survives. The link answers 410 ' +
      'from the next request onward.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.sharesService.revoke(id, user.id);
  }

  @Get('shared-with-me')
  @ApiOperation({
    summary: 'Items other people have shared with this user',
    description:
      'Matched by user id or by email, so a grant issued before the recipient ' +
      'registered appears the moment they sign in.',
  })
  @ApiZodArrayResponse(200, sharedWithMeItemSchema, 'Shared items')
  sharedWithMe(@CurrentUser() user: RequestUser): Promise<SharedWithMeItem[]> {
    return this.sharesService.listSharedWithMe(user.id, user.email);
  }

  @Get('shared-by-me')
  @ApiOperation({
    summary: 'Every live link this user has handed out',
    description:
      'The counterpart to `GET /shares?nodeId=`, which answers "who can see ' +
      'this item?". This answers "what have I given away?" across the whole ' +
      'room, which is the only way to find a link on a folder buried several ' +
      'levels down. Each item carries its path so two folders of the same ' +
      'name are tellable apart. Revoked and expired links are omitted.',
  })
  @ApiZodArrayResponse(200, sharedByMeItemSchema, 'Links, newest first')
  sharedByMe(@CurrentUser() user: RequestUser): Promise<SharedByMeItem[]> {
    return this.sharesService.listSharedByMe(user.id);
  }
}

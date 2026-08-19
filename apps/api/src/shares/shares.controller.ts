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
import {
  createShareSchema,
  sharesQuerySchema,
  type CreateShareInput,
  type ShareDto,
  type SharedWithMeItem,
  type SharesQuery,
} from '@dataroom/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../auth/decorators';
import { SharesService } from './shares.service';

@Controller()
export class SharesController {
  constructor(private readonly sharesService: SharesService) {}

  @Post('shares')
  create(
    @Body(zodPipe(createShareSchema)) body: CreateShareInput,
    @CurrentUser() user: RequestUser,
  ): Promise<ShareDto> {
    return this.sharesService.create(body, user.id);
  }

  @Get('shares')
  list(
    @Query(zodPipe(sharesQuerySchema)) query: SharesQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<ShareDto[]> {
    return this.sharesService.listForNode(query.nodeId, user.id);
  }

  @Post('shares/:id/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.sharesService.revoke(id, user.id);
  }

  @Get('shared-with-me')
  sharedWithMe(@CurrentUser() user: RequestUser): Promise<SharedWithMeItem[]> {
    return this.sharesService.listSharedWithMe(user.id, user.email);
  }
}

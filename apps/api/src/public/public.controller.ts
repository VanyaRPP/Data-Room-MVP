import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  childrenQuerySchema,
  type BreadcrumbDto,
  type ChildrenQuery,
  type FileUrlDto,
  type NodePage,
  type PublicShareDto,
} from '@dataroom/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { OptionalUser, Public, type RequestUser } from '../auth/decorators';
import type { ShareViewer } from '../access/access.service';
import { PublicService } from './public.service';

/**
 * Share links, open to anyone holding the token.
 *
 * @Public() only means "a session is not required" - the guard still attaches
 * one when the cookie is present, which is what lets a RESTRICTED share tell
 * whether the visitor is someone it was shared with.
 */
@Public()
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get(':token')
  describe(
    @Param('token') token: string,
    @OptionalUser() user: RequestUser | undefined,
  ): Promise<PublicShareDto> {
    return this.publicService.describe(token, toViewer(user));
  }

  @Get(':token/nodes/:id/children')
  listChildren(
    @Param('token') token: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodPipe(childrenQuerySchema)) query: ChildrenQuery,
    @OptionalUser() user: RequestUser | undefined,
  ): Promise<NodePage> {
    return this.publicService.listChildren(token, id, query, toViewer(user));
  }

  @Get(':token/nodes/:id/breadcrumbs')
  breadcrumbs(
    @Param('token') token: string,
    @Param('id', ParseUUIDPipe) id: string,
    @OptionalUser() user: RequestUser | undefined,
  ): Promise<BreadcrumbDto[]> {
    return this.publicService.breadcrumbs(token, id, toViewer(user));
  }

  @Get(':token/files/:id/url')
  fileUrl(
    @Param('token') token: string,
    @Param('id', ParseUUIDPipe) id: string,
    @OptionalUser() user: RequestUser | undefined,
  ): Promise<FileUrlDto> {
    return this.publicService.createViewUrl(token, id, toViewer(user));
  }
}

function toViewer(user: RequestUser | undefined): ShareViewer {
  return user ? { userId: user.id, email: user.email } : {};
}

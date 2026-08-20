import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  apiErrorShape,
  breadcrumbDtoSchema,
  childrenQuerySchema,
  fileUrlDtoSchema,
  fileUrlQuerySchema,
  nodePageSchema,
  publicShareDtoSchema,
  type BreadcrumbDto,
  type ChildrenQuery,
  type FileUrlDto,
  type FileUrlQuery,
  type NodePage,
  type PublicShareDto,
} from '@dataroom/shared';
import {
  ApiZodArrayResponse,
  ApiZodQuery,
  ApiZodResponse,
} from '../common/api-docs';
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
@ApiTags('Share links')
@ApiParam({ name: 'token', description: 'The token from a share link' })
@Public()
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get(':token')
  @ApiOperation({
    summary: 'What this link points at',
    description:
      'A public link opens for anyone. A restricted one answers 401 for a ' +
      'signed-out visitor and 403 for a signed-in one who was not granted ' +
      'access. A revoked, deleted or invented token is 410 either way - ' +
      'telling those apart would confirm a token was once real.',
  })
  @ApiZodResponse(200, publicShareDtoSchema, 'The shared item')
  @ApiZodResponse(401, apiErrorShape, 'Restricted: sign in first')
  @ApiZodResponse(403, apiErrorShape, 'Restricted: not shared with you')
  @ApiZodResponse(410, apiErrorShape, 'The link is no longer available')
  describe(
    @Param('token') token: string,
    @OptionalUser() user: RequestUser | undefined,
  ): Promise<PublicShareDto> {
    return this.publicService.describe(token, toViewer(user));
  }

  @Get(':token/nodes/:id/children')
  @ApiOperation({
    summary: 'Contents of a folder inside the share',
    description:
      'Identical to the owner-facing listing. A node outside the shared ' +
      'subtree answers 404: the link grants access to a branch, not a room.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Folder id' })
  @ApiZodQuery(childrenQuerySchema)
  @ApiZodResponse(200, nodePageSchema, 'One page of contents')
  @ApiZodResponse(404, apiErrorShape, 'Not inside this share')
  listChildren(
    @Param('token') token: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodPipe(childrenQuerySchema)) query: ChildrenQuery,
    @OptionalUser() user: RequestUser | undefined,
  ): Promise<NodePage> {
    return this.publicService.listChildren(token, id, query, toViewer(user));
  }

  @Get(':token/nodes/:id/breadcrumbs')
  @ApiOperation({
    summary: 'The path within the share',
    description:
      'Stops at whatever was shared, so a link cannot reveal the folder names ' +
      'above it.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Folder or file id' })
  @ApiZodArrayResponse(200, breadcrumbDtoSchema, 'Shared root first')
  breadcrumbs(
    @Param('token') token: string,
    @Param('id', ParseUUIDPipe) id: string,
    @OptionalUser() user: RequestUser | undefined,
  ): Promise<BreadcrumbDto[]> {
    return this.publicService.breadcrumbs(token, id, toViewer(user));
  }

  @Get(':token/files/:id/url')
  @ApiOperation({
    summary: 'A short-lived URL for a file inside the share',
    description:
      'Inline by default; `download=true` offers it as a file instead. ' +
      'Read-only governs what a visitor may change, not what they may keep.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'File id' })
  @ApiZodQuery(fileUrlQuerySchema)
  @ApiZodResponse(200, fileUrlDtoSchema, 'Signed URL and its expiry')
  fileUrl(
    @Param('token') token: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodPipe(fileUrlQuerySchema)) query: FileUrlQuery,
    @OptionalUser() user: RequestUser | undefined,
  ): Promise<FileUrlDto> {
    return this.publicService.createViewUrl(token, id, toViewer(user), query);
  }
}

function toViewer(user: RequestUser | undefined): ShareViewer {
  return user ? { userId: user.id, email: user.email } : {};
}

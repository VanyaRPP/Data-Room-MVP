import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  paginationQuerySchema,
  renameNodeSchema,
  type BreadcrumbDto,
  type DeletePreviewDto,
  type NodeDto,
  type NodePage,
  type PaginationQuery,
  type RenameNodeInput,
} from '@dataroom/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../auth/decorators';
import { NodesService } from './nodes.service';

@Controller('nodes')
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Get(':id/children')
  listChildren(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodPipe(paginationQuerySchema)) query: PaginationQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<NodePage> {
    return this.nodesService.listChildren(id, user.id, query);
  }

  @Get(':id/breadcrumbs')
  breadcrumbs(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<BreadcrumbDto[]> {
    return this.nodesService.breadcrumbs(id, user.id);
  }

  @Get(':id/delete-preview')
  deletePreview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<DeletePreviewDto> {
    return this.nodesService.deletePreview(id, user.id);
  }

  @Patch(':id')
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(renameNodeSchema)) body: RenameNodeInput,
    @CurrentUser() user: RequestUser,
  ): Promise<NodeDto> {
    return this.nodesService.rename(id, user.id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.nodesService.delete(id, user.id);
  }
}

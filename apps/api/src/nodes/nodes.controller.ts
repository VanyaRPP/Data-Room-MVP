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
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  apiErrorShape,
  breadcrumbDtoSchema,
  childrenQuerySchema,
  deletePreviewDtoSchema,
  moveNodeSchema,
  moveNodesSchema,
  nodeBatchSchema,
  nodeDtoSchema,
  nodePageSchema,
  renameNodeSchema,
  type BreadcrumbDto,
  type ChildrenQuery,
  type DeletePreviewDto,
  type MoveNodeInput,
  type MoveNodesInput,
  type NodeBatchInput,
  type NodeDto,
  type NodePage,
  type RenameNodeInput,
} from '@dataroom/shared';
import {
  ApiZodArrayResponse,
  ApiZodBody,
  ApiZodQuery,
  ApiZodResponse,
} from '../common/api-docs';
import { zodPipe } from '../common/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../auth/decorators';
import { NodesService } from './nodes.service';

/**
 * The `:id` path parameter. Applied per route rather than to the controller,
 * so the batch endpoints below - which have no id in their path - are not
 * documented as taking one.
 */
const ApiNodeId = (): MethodDecorator =>
  ApiParam({ name: 'id', format: 'uuid', description: 'Folder or file id' });

@ApiTags('Nodes')
@Controller('nodes')
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Get(':id/children')
  @ApiNodeId()
  @ApiOperation({
    summary: "A folder's contents, one page at a time",
    description:
      'Folders sort before files, then by name. Pass the `nextCursor` from a ' +
      'response back as `cursor` for the next page; the cursor is opaque and ' +
      'should not be parsed. Files still uploading are never listed.',
  })
  @ApiZodQuery(childrenQuerySchema)
  @ApiZodResponse(200, nodePageSchema, 'One page of contents')
  @ApiZodResponse(404, apiErrorShape, 'No such folder, or not yours')
  listChildren(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodPipe(childrenQuerySchema)) query: ChildrenQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<NodePage> {
    return this.nodesService.listChildren(id, user.id, query);
  }

  @Get(':id/breadcrumbs')
  @ApiNodeId()
  @ApiOperation({ summary: 'The path from the room root down to this node' })
  @ApiZodArrayResponse(200, breadcrumbDtoSchema, 'Root first, node last')
  breadcrumbs(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<BreadcrumbDto[]> {
    return this.nodesService.breadcrumbs(id, user.id);
  }

  @Get(':id/delete-preview')
  @ApiNodeId()
  @ApiOperation({
    summary: 'What deleting this node would remove',
    description:
      'Counts the whole subtree, including the node itself, so the ' +
      'confirmation can state real numbers rather than a vague warning.',
  })
  @ApiZodResponse(200, deletePreviewDtoSchema, 'Subtree totals')
  deletePreview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<DeletePreviewDto> {
    return this.nodesService.deletePreview(id, user.id);
  }

  @Patch(':id')
  @ApiNodeId()
  @ApiOperation({ summary: 'Rename a folder or file' })
  @ApiZodBody(renameNodeSchema)
  @ApiZodResponse(200, nodeDtoSchema, 'The renamed node')
  @ApiZodResponse(400, apiErrorShape, 'The room root cannot be renamed')
  @ApiZodResponse(409, apiErrorShape, 'A sibling already uses that name')
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(renameNodeSchema)) body: RenameNodeInput,
    @CurrentUser() user: RequestUser,
  ): Promise<NodeDto> {
    return this.nodesService.rename(id, user.id, body);
  }

  @Post(':id/move')
  @ApiNodeId()
  @ApiOperation({
    summary: 'Move a folder or file into another folder',
    description:
      'A name already taken in the target answers 409 by default; send ' +
      '`onConflict: "rename"` to keep both by suffixing instead. A folder ' +
      'cannot move into its own subtree.',
  })
  @ApiZodBody(moveNodeSchema)
  @ApiZodResponse(200, nodeDtoSchema, 'The moved node')
  @ApiZodResponse(400, apiErrorShape, 'Would detach a folder from the root')
  @ApiZodResponse(409, apiErrorShape, 'That name is taken in the target')
  // A move creates nothing, so it answers 200 rather than the 201 Nest gives
  // every POST by default - which is also what the documentation above says.
  @HttpCode(HttpStatus.OK)
  move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(zodPipe(moveNodeSchema)) body: MoveNodeInput,
    @CurrentUser() user: RequestUser,
  ): Promise<NodeDto> {
    return this.nodesService.move(id, user.id, body);
  }

  @Delete(':id')
  @ApiNodeId()
  @ApiOperation({
    summary: 'Delete a node and everything beneath it',
    description:
      'Cascades through the subtree and removes the stored files, including ' +
      'every superseded version of them.',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.nodesService.delete(id, user.id);
  }

  @Post('move')
  @ApiOperation({
    summary: 'Move several items into one folder',
    description:
      'The batch form of `POST /nodes/{id}/move`, and one transaction: ' +
      'either everything lands in the target or nothing does. A name already ' +
      'taken there answers 409 naming what clashed, so the caller can retry ' +
      'with `onConflict: "rename"` rather than discover a half-finished move. ' +
      'Selecting a folder together with something inside it answers 400.',
  })
  @ApiZodBody(moveNodesSchema)
  @ApiZodArrayResponse(200, nodeDtoSchema, 'The items, where they now live')
  @ApiZodResponse(400, apiErrorShape, 'The batch is not a set of subtrees')
  @ApiZodResponse(409, apiErrorShape, 'Those names are taken in the target')
  @HttpCode(HttpStatus.OK)
  moveMany(
    @Body(zodPipe(moveNodesSchema)) body: MoveNodesInput,
    @CurrentUser() user: RequestUser,
  ): Promise<NodeDto[]> {
    return this.nodesService.moveMany(body, user.id);
  }

  @Post('delete-preview')
  @ApiOperation({
    summary: 'What deleting this selection would remove',
    description:
      'Totals across every selected subtree, counted once each even where ' +
      'the selection overlaps itself.',
  })
  @ApiZodBody(nodeBatchSchema)
  @ApiZodResponse(200, deletePreviewDtoSchema, 'Combined subtree totals')
  // A POST only because the selection travels in the body; it reads, so 200.
  @HttpCode(HttpStatus.OK)
  deletePreviewMany(
    @Body(zodPipe(nodeBatchSchema)) body: NodeBatchInput,
    @CurrentUser() user: RequestUser,
  ): Promise<DeletePreviewDto> {
    return this.nodesService.deletePreviewMany(body, user.id);
  }

  @Post('delete')
  @ApiOperation({
    summary: 'Delete several items and everything beneath them',
    description:
      'The batch form of `DELETE /nodes/{id}`, and one transaction. ' +
      'Selecting a folder together with something inside it answers 400.',
  })
  @ApiZodBody(nodeBatchSchema)
  @ApiZodResponse(400, apiErrorShape, 'The batch is not a set of subtrees')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMany(
    @Body(zodPipe(nodeBatchSchema)) body: NodeBatchInput,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.nodesService.deleteMany(body, user.id);
  }
}

import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  apiErrorShape,
  createFolderSchema,
  nodeDtoSchema,
  type CreateFolderInput,
  type NodeDto,
} from '@dataroom/shared';
import { ApiZodBody, ApiZodResponse } from '../common/api-docs';
import { zodPipe } from '../common/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../auth/decorators';
import { NodesService } from './nodes.service';

/**
 * Folder creation lives on its own resource path because it is the one node
 * operation that isn't addressed by an existing node id. Everything else a
 * folder can do is shared with files and lives on /nodes/:id.
 */
@ApiTags('Folders')
@Controller('folders')
export class FoldersController {
  constructor(private readonly nodesService: NodesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a folder',
    description:
      'Names are unique within a folder, case-insensitively: "Report" and ' +
      '"report" cannot both exist side by side.',
  })
  @ApiZodBody(createFolderSchema)
  @ApiZodResponse(201, nodeDtoSchema, 'The new folder')
  @ApiZodResponse(409, apiErrorShape, 'That name is already used here')
  create(
    @Body(zodPipe(createFolderSchema)) body: CreateFolderInput,
    @CurrentUser() user: RequestUser,
  ): Promise<NodeDto> {
    return this.nodesService.createFolder(body, user.id);
  }
}

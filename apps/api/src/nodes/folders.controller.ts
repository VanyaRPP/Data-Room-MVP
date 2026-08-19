import { Body, Controller, Post } from '@nestjs/common';
import {
  createFolderSchema,
  type CreateFolderInput,
  type NodeDto,
} from '@dataroom/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../auth/decorators';
import { NodesService } from './nodes.service';

/**
 * Folder creation lives on its own resource path because it is the one node
 * operation that isn't addressed by an existing node id. Everything else a
 * folder can do is shared with files and lives on /nodes/:id.
 */
@Controller('folders')
export class FoldersController {
  constructor(private readonly nodesService: NodesService) {}

  @Post()
  create(
    @Body(zodPipe(createFolderSchema)) body: CreateFolderInput,
    @CurrentUser() user: RequestUser,
  ): Promise<NodeDto> {
    return this.nodesService.createFolder(body, user.id);
  }
}

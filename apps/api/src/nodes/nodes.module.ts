import { Module } from '@nestjs/common';
import { FoldersController } from './folders.controller';
import { NameConflictService } from './name-conflict.service';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';

@Module({
  controllers: [NodesController, FoldersController],
  providers: [NodesService, NameConflictService],
  exports: [NameConflictService],
})
export class NodesModule {}

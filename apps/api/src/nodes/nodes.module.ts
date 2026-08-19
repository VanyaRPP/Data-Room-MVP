import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { FoldersController } from './folders.controller';
import { NameConflictService } from './name-conflict.service';
import { NodeQueriesService } from './node-queries.service';
import { NodesController } from './nodes.controller';
import { NodesService } from './nodes.service';

@Module({
  imports: [StorageModule],
  controllers: [NodesController, FoldersController],
  providers: [NodesService, NameConflictService, NodeQueriesService],
  exports: [NameConflictService, NodeQueriesService],
})
export class NodesModule {}

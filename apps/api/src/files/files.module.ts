import { Module } from '@nestjs/common';
import { NodesModule } from '../nodes/nodes.module';
import { StorageModule } from '../storage/storage.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  // NodesModule for NameConflictService: upload auto-suffixes duplicate names
  // with exactly the same rules folder creation uses.
  imports: [NodesModule, StorageModule],
  controllers: [FilesController],
  providers: [FilesService],
})
export class FilesModule {}

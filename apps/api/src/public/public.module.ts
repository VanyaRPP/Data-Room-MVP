import { Module } from '@nestjs/common';
import { NodesModule } from '../nodes/nodes.module';
import { StorageModule } from '../storage/storage.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  // NodesModule for NodeQueriesService: a shared folder must list exactly the
  // same way the owner's own view does.
  imports: [NodesModule, StorageModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}

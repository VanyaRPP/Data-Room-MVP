import { Global, Module } from '@nestjs/common';
import { AccessService } from './access.service';

// Global for the same reason as PrismaModule: every feature module that touches
// a node needs this, and re-importing it everywhere is pure ceremony.
@Global()
@Module({
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}

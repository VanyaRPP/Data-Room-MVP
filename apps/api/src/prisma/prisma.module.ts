import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global: nearly every module needs database access, and re-importing this
// everywhere would be pure ceremony.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

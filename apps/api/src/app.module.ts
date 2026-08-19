import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { BigIntSerializerInterceptor } from './common/bigint-serializer.interceptor';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AccessModule } from './access/access.module';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { NodesModule } from './nodes/nodes.module';
import { PublicModule } from './public/public.module';
import { RoomsModule } from './rooms/rooms.module';
import { SharesModule } from './shares/shares.module';

@Module({
  imports: [
    PrismaModule,
    AccessModule,
    AuthModule,
    RoomsModule,
    NodesModule,
    FilesModule,
    SharesModule,
    PublicModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: BigIntSerializerInterceptor },
  ],
})
export class AppModule {}

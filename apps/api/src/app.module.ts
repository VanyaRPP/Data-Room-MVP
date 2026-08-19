import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { BigIntSerializerInterceptor } from './common/bigint-serializer.interceptor';
import { HealthController } from './health.controller';

@Module({
  imports: [],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: BigIntSerializerInterceptor },
  ],
})
export class AppModule {}

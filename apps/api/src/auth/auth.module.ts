import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { env } from '../common/env';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
    // Scoped to this module so it only ever guards AuthController's routes,
    // per spec ("rate limit on /auth/* only") - not registered globally.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Registered here (not AppModule) so JwtAuthGuard's JwtService dependency
    // resolves from this module's own imports; APP_GUARD still applies it
    // globally regardless of which module declares it.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AuthModule {}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { SESSION_COOKIE_NAME } from '@dataroom/shared';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './decorators';

interface SessionJwtPayload {
  sub: string;
  email: string;
}

function isSessionJwtPayload(value: unknown): value is SessionJwtPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).sub === 'string' &&
    typeof (value as Record<string, unknown>).email === 'string'
  );
}

/**
 * Global guard: always attempts to verify the session cookie and attach
 * `request.user`, even on @Public() routes - the public share endpoints need
 * to know whether an optional viewer is logged in (for RESTRICTED grants).
 * Only routes without @Public() require that verification to have succeeded.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const cookies = request.cookies as
      Record<string, string | undefined> | undefined;
    const token = cookies?.[SESSION_COOKIE_NAME];

    if (token) {
      try {
        const payload: unknown = await this.jwtService.verifyAsync(token);
        if (isSessionJwtPayload(payload)) {
          request.user = { id: payload.sub, email: payload.email };
        }
      } catch {
        // Expired or tampered token: fall through and treat as anonymous.
      }
    }

    if (request.user) return true;
    if (isPublic) return true;
    throw new UnauthorizedException('Authentication required');
  }
}

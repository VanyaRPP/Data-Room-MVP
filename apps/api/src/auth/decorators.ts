import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';

export interface RequestUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

/** Marks a route as reachable without a valid session cookie. See JwtAuthGuard. */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(IS_PUBLIC_KEY, true);

/** The authenticated user attached to the request by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    if (!request.user) {
      throw new Error(
        '@CurrentUser() used on a route without an authenticated user',
      );
    }
    return request.user;
  },
);

/**
 * The user if there is one, undefined otherwise. For @Public() routes where
 * identity is optional but still meaningful - a share link may be public, or
 * restricted to specific people who have to be recognised.
 */
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser | undefined =>
    ctx.switchToHttp().getRequest<Request>().user,
);

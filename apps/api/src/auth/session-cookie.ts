import type { Response } from 'express';
import { SESSION_COOKIE_NAME } from '@dataroom/shared';
import { env } from '../common/env';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// No `domain` attribute on either call: the web app only ever reaches the
// API through the same-origin Next.js rewrite, so a host-only cookie is both
// sufficient and the more conservative choice.
function cookieOptions(): {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: '/';
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...cookieOptions(),
    maxAge: SEVEN_DAYS_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, cookieOptions());
}

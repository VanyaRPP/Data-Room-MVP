import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/** The one error shape every API response ever returns on failure. */
export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
}

/**
 * Normalizes every thrown error - HttpException or not - into ApiErrorBody.
 * Unknown errors are logged with their stack and reported to the client as a
 * generic 500 so internals never leak.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toApiErrorBody(exception);
    response.status(body.statusCode).json(body);
  }

  private toApiErrorBody(exception: unknown): ApiErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      return {
        statusCode: status,
        error: reasonPhrase(status),
        message: this.extractMessage(payload, exception.message),
      };
    }

    this.logger.error(
      exception instanceof Error ? exception.message : 'Unknown error',
      exception instanceof Error ? exception.stack : undefined,
    );

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Something went wrong. Please try again.',
    };
  }

  private extractMessage(payload: unknown, fallback: string): string {
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object' && 'message' in payload) {
      const { message } = payload;
      if (typeof message === 'string') return message;
      if (
        Array.isArray(message) &&
        message.every((m): m is string => typeof m === 'string')
      ) {
        return message.join(', ');
      }
    }
    return fallback;
  }
}

/** `404` -> `Not Found`: HttpStatus names it NOT_FOUND, humans don't. */
function reasonPhrase(status: number): string {
  const name = HttpStatus[status];
  if (!name) return 'Error';

  return name
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

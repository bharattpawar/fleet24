import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTPException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;

    let errorMessage = 'Internal server error';
    let errorDetails: unknown = null;

    if (typeof exceptionResponse === 'string') {
      errorMessage = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const respObj = exceptionResponse as Record<string, unknown>;
      errorMessage = (respObj.message as string) || errorMessage;
      errorDetails = respObj.error || null;
    } else if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
      errorMessage = exception.message;
    }

    // Server-side logging with error stack if unhandled, without leaking details to client
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - Status: ${status} - Error: ${
          exception instanceof Error ? exception.stack : JSON.stringify(exception)
        }`,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} - Status: ${status} - Message: ${errorMessage}`,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: errorMessage,
      ...(errorDetails !== null && errorDetails !== undefined ? { details: errorDetails } : {}),
    });
  }
}

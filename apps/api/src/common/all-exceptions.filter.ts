import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';

interface HttpResponse {
  status(statusCode: number): { json(body: unknown): void };
}

interface SafeErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<HttpResponse>();
    const body = safeErrorBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(
        JSON.stringify({ code: body.code, statusCode: body.statusCode }),
      );
    }
    response.status(body.statusCode).json(body);
  }
}

function safeErrorBody(exception: unknown): SafeErrorBody {
  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    const response = exception.getResponse();
    if (isSafeBody(response, statusCode)) {
      return response;
    }
    return {
      statusCode,
      code: statusCode === 400 ? 'VALIDATION_FAILED' : 'INTERNAL_ERROR',
      message:
        statusCode === 400
          ? 'The request parameters are invalid.'
          : 'The request could not be completed.',
    };
  }
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
  };
}

function isSafeBody(
  value: unknown,
  statusCode: number,
): value is SafeErrorBody {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const body = value as Partial<SafeErrorBody>;
  return (
    body.statusCode === statusCode &&
    typeof body.code === 'string' &&
    typeof body.message === 'string'
  );
}

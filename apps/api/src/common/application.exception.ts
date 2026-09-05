import { HttpException, type HttpStatus } from '@nestjs/common';

export class ApplicationException extends HttpException {
  constructor(
    statusCode: HttpStatus,
    code: string,
    message: string,
    details?: Array<{ field: string; message: string }>,
  ) {
    super(
      {
        statusCode,
        code,
        message,
        ...(details ? { details } : {}),
      },
      statusCode,
    );
  }
}

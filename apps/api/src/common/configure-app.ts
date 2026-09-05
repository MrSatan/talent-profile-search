import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import helmet from 'helmet';
import { AllExceptionsFilter } from './all-exceptions.filter';

export function configureApp(app: INestApplication, webOrigin: string): void {
  app.use(helmet());
  app.enableCors({ origin: webOrigin, methods: ['GET'], credentials: false });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: false,
      exceptionFactory: (errors) => validationException(errors),
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
}

function validationException(errors: ValidationError[]): BadRequestException {
  const details = errors.flatMap((error) =>
    Object.values(error.constraints ?? {}).map((message) => ({
      field: error.property,
      message,
    })),
  );
  return new BadRequestException({
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message: 'The request parameters are invalid.',
    details,
  });
}

import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ImporterService, ImportValidationError } from './importer.service';

const logger = new Logger('DataImport');

async function run(): Promise<void> {
  let app: Awaited<
    ReturnType<typeof NestFactory.createApplicationContext>
  > | null = null;
  try {
    const options = parseArguments(process.argv.slice(2));
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['log', 'error', 'warn'],
    });
    const config = app.get(ConfigService);
    const datasetPath = config.getOrThrow<string>('DATASET_PATH');
    const report = await app.get(ImporterService).import(datasetPath, options);
    logger.log(JSON.stringify({ code: 'IMPORT_COMPLETE', ...report }));
  } catch (error) {
    process.exitCode = 1;
    if (error instanceof ImportValidationError) {
      logger.error(JSON.stringify({ code: 'IMPORT_FAILED', ...error.report }));
    } else {
      logger.error(
        JSON.stringify({
          code: 'IMPORT_FAILED',
          message: 'The dataset could not be imported.',
          ...(app
            ? {
                expectedPath: app
                  .get(ConfigService)
                  .getOrThrow<string>('DATASET_PATH'),
              }
            : {}),
        }),
      );
    }
  } finally {
    await app?.close();
  }
}

function parseArguments(args: string[]): { dryRun: boolean; replace: boolean } {
  const normalized = args.filter((argument) => argument !== '--');
  const supported = new Set(['--dry-run', '--replace']);
  const unknown = normalized.find((argument) => !supported.has(argument));
  if (unknown) {
    throw new Error('Unsupported import option.');
  }
  return {
    dryRun: normalized.includes('--dry-run'),
    replace: normalized.includes('--replace'),
  };
}

void run();

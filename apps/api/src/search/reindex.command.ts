import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ProfileIndexerService } from './profile-indexer.service';

const logger = new Logger('SearchReindex');

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  try {
    const report = await app.get(ProfileIndexerService).rebuild();
    logger.log(JSON.stringify({ code: 'REINDEX_COMPLETE', ...report }));
  } catch {
    process.exitCode = 1;
    logger.error(
      JSON.stringify({
        code: 'REINDEX_FAILED',
        message: 'The search index could not be rebuilt.',
      }),
    );
  } finally {
    await app.close();
  }
}

void run();

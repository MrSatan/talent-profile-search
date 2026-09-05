import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { ImporterService } from './importer.service';

@Module({
  imports: [ProfilesModule],
  providers: [ImporterService],
  exports: [ImporterService],
})
export class IngestionModule {}

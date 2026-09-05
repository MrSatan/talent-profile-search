import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { SearchModule } from '../search/search.module';
import { HealthController } from './health.controller';

@Module({
  imports: [ProfilesModule, SearchModule],
  controllers: [HealthController],
})
export class HealthModule {}

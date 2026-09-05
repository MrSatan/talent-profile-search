import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import { ProfilesModule } from '../profiles/profiles.module';
import { ProfileIndexerService } from './profile-indexer.service';
import { SearchController } from './search.controller';
import { SearchRepository } from './search.repository';
import { SearchService } from './search.service';
import { ELASTICSEARCH_CLIENT } from './search.tokens';

@Module({
  imports: [ProfilesModule],
  controllers: [SearchController],
  providers: [
    {
      provide: ELASTICSEARCH_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Client => {
        const username = config.getOrThrow<string>('ELASTICSEARCH_USERNAME');
        const password = config.getOrThrow<string>('ELASTICSEARCH_PASSWORD');
        return new Client({
          node: config.getOrThrow<string>('ELASTICSEARCH_NODE'),
          ...(username && password ? { auth: { username, password } } : {}),
        });
      },
    },
    SearchRepository,
    SearchService,
    ProfileIndexerService,
  ],
  exports: [SearchRepository, ProfileIndexerService],
})
export class SearchModule {}

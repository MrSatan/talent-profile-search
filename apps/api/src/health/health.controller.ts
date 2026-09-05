import { Controller, Get, HttpStatus, Inject } from '@nestjs/common';
import { ApplicationException } from '../common/application.exception';
import { ProfilesRepository } from '../profiles/profiles.repository';
import { SearchRepository } from '../search/search.repository';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(ProfilesRepository)
    private readonly profilesRepository: ProfilesRepository,
    @Inject(SearchRepository)
    private readonly searchRepository: SearchRepository,
  ) {}

  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<{ status: 'ready' }> {
    try {
      await this.profilesRepository.ping();
    } catch {
      throw new ApplicationException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'DATABASE_UNAVAILABLE',
        'The profile database is temporarily unavailable.',
      );
    }
    await this.searchRepository.checkReady();
    return { status: 'ready' };
  }
}

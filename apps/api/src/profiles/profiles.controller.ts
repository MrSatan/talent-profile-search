import { Controller, Get, Inject, Param, ParseUUIDPipe } from '@nestjs/common';
import type { ProfileDetailDto } from './dto/profile-detail.dto';
import { ProfilesService } from './profiles.service';

@Controller('api/v1/profiles')
export class ProfilesController {
  constructor(
    @Inject(ProfilesService) private readonly profilesService: ProfilesService,
  ) {}

  @Get(':id')
  getById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ProfileDetailDto> {
    return this.profilesService.getById(id);
  }
}

import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ApplicationException } from '../common/application.exception';
import type { ProfileDetailDto } from './dto/profile-detail.dto';
import { ProfilesRepository } from './profiles.repository';

@Injectable()
export class ProfilesService {
  constructor(
    @Inject(ProfilesRepository)
    private readonly profilesRepository: ProfilesRepository,
  ) {}

  async getById(id: string): Promise<ProfileDetailDto> {
    const profile = await this.profilesRepository.findById(id);
    if (!profile) {
      throw new ApplicationException(
        HttpStatus.NOT_FOUND,
        'PROFILE_NOT_FOUND',
        'The profile could not be found.',
      );
    }
    return {
      id: profile.id,
      fullName: profile.fullName,
      jobTitle: profile.jobTitle,
      companyName: profile.companyName,
      industry: profile.industry,
      location: profile.location,
      country: profile.country,
      summary: profile.summary,
      yearsExperience: profile.yearsExperience,
      skills: profile.skills.map((skill) => skill.name),
      experience: profile.experience,
      education: profile.education,
      linkedinUrl: profile.linkedinUrl,
    };
  }
}

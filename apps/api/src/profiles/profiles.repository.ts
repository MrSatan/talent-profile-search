import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type {
  CanonicalProfile,
  EducationRecord,
  EmploymentRecord,
  ProfileProjection,
} from './profile.types';

type ProfileWithSkills = Prisma.ProfileGetPayload<{
  include: { skills: { include: { skill: true } } };
}>;

@Injectable()
export class ProfilesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async importProfiles(
    profiles: CanonicalProfile[],
    replace: boolean,
  ): Promise<number> {
    return this.prisma.$transaction(
      async (transaction) => {
        if (replace) {
          await transaction.profileSkill.deleteMany();
          await transaction.profile.deleteMany();
          await transaction.skill.deleteMany();
        }

        const uniqueSkills = new Map(
          profiles.flatMap((profile) =>
            profile.skills.map(
              (skill) => [skill.normalizedName, skill] as const,
            ),
          ),
        );
        await createSkillsInBatches(transaction, [...uniqueSkills.values()]);
        const skillsByName = await readSkillsInBatches(transaction, [
          ...uniqueSkills.keys(),
        ]);

        const profileIds = new Map<string, string>();
        for (const profile of profiles) {
          const data = profileData(profile);
          const saved = await transaction.profile.upsert({
            where: { linkedinUrl: profile.linkedinUrl },
            create: data,
            update: data,
            select: { id: true },
          });
          profileIds.set(profile.linkedinUrl, saved.id);
        }

        const affectedIds = [...profileIds.values()];
        if (affectedIds.length > 0) {
          await transaction.profileSkill.deleteMany({
            where: { profileId: { in: affectedIds } },
          });
        }

        const relations = profiles.flatMap((profile) => {
          const profileId = profileIds.get(profile.linkedinUrl);
          if (!profileId) {
            return [];
          }
          return profile.skills.flatMap((skill) => {
            const skillId = skillsByName.get(skill.normalizedName);
            return skillId ? [{ profileId, skillId }] : [];
          });
        });
        for (let index = 0; index < relations.length; index += 5_000) {
          await transaction.profileSkill.createMany({
            data: relations.slice(index, index + 5_000),
            skipDuplicates: true,
          });
        }
        return profiles.length;
      },
      { maxWait: 30_000, timeout: 120_000 },
    );
  }

  async count(): Promise<number> {
    return this.prisma.profile.count();
  }

  async readProjectionPage(
    cursor: string | null,
    take: number,
  ): Promise<ProfileProjection[]> {
    const profiles = await this.prisma.profile.findMany({
      orderBy: { id: 'asc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        skills: {
          include: { skill: true },
          orderBy: { skill: { normalizedName: 'asc' } },
        },
      },
    });

    return profiles.map(toProjection);
  }

  async findById(id: string): Promise<ProfileProjection | null> {
    const profile = await this.prisma.profile.findUnique({
      where: { id },
      include: {
        skills: {
          include: { skill: true },
          orderBy: { skill: { normalizedName: 'asc' } },
        },
      },
    });
    return profile ? toProjection(profile) : null;
  }

  async ping(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}

function toProjection(profile: ProfileWithSkills): ProfileProjection {
  return {
    id: profile.id,
    linkedinUrl: profile.linkedinUrl,
    linkedinId: profile.linkedinId,
    fullName: profile.fullName,
    jobTitle: profile.jobTitle,
    companyName: profile.companyName,
    industry: profile.industry,
    location: profile.location,
    normalizedLocation: profile.normalizedLocation,
    country: profile.country,
    summary: profile.summary,
    yearsExperience: profile.yearsExperience,
    experience: profile.experience as unknown as EmploymentRecord[],
    education: profile.education as unknown as EducationRecord[],
    skills: profile.skills.map(({ skill }) => ({
      name: skill.name,
      normalizedName: skill.normalizedName,
    })),
  };
}

function profileData(
  profile: CanonicalProfile,
): Prisma.ProfileUncheckedCreateInput {
  return {
    linkedinUrl: profile.linkedinUrl,
    linkedinId: profile.linkedinId,
    fullName: profile.fullName,
    jobTitle: profile.jobTitle,
    companyName: profile.companyName,
    industry: profile.industry,
    location: profile.location,
    normalizedLocation: profile.normalizedLocation,
    country: profile.country,
    summary: profile.summary,
    yearsExperience: profile.yearsExperience,
    experience: profile.experience as unknown as Prisma.InputJsonValue,
    education: profile.education as unknown as Prisma.InputJsonValue,
  };
}

async function createSkillsInBatches(
  transaction: Prisma.TransactionClient,
  skills: CanonicalProfile['skills'],
): Promise<void> {
  for (let index = 0; index < skills.length; index += 5_000) {
    await transaction.skill.createMany({
      data: skills.slice(index, index + 5_000),
      skipDuplicates: true,
    });
  }
}

async function readSkillsInBatches(
  transaction: Prisma.TransactionClient,
  normalizedNames: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (let index = 0; index < normalizedNames.length; index += 5_000) {
    const skills = await transaction.skill.findMany({
      where: {
        normalizedName: { in: normalizedNames.slice(index, index + 5_000) },
      },
      select: { id: true, normalizedName: true },
    });
    for (const skill of skills) {
      result.set(skill.normalizedName, skill.id);
    }
  }
  return result;
}

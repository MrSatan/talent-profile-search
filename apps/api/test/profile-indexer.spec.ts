import type { ConfigService } from '@nestjs/config';
import type { Client } from '@elastic/elasticsearch';
import type { ProfilesRepository } from '../src/profiles/profiles.repository';
import type { ProfileProjection } from '../src/profiles/profile.types';
import { ProfileIndexerService } from '../src/search/profile-indexer.service';

describe('profile index rebuild safety', () => {
  it('deletes the incomplete index without changing the alias after bulk failure', async () => {
    const updateAliases = vi.fn();
    const deleteIndex = vi.fn().mockResolvedValue({ acknowledged: true });
    const client = {
      indices: {
        create: vi.fn().mockResolvedValue({ acknowledged: true }),
        delete: deleteIndex,
        refresh: vi.fn(),
        updateAliases,
      },
      bulk: vi.fn().mockResolvedValue({ errors: true }),
    } as unknown as Client;
    const projection: ProfileProjection = {
      id: '00000000-0000-4000-8000-000000000001',
      linkedinUrl: 'https://www.linkedin.com/in/synthetic-profile',
      linkedinId: null,
      fullName: 'Synthetic Profile',
      jobTitle: null,
      companyName: null,
      industry: null,
      location: null,
      normalizedLocation: null,
      country: null,
      summary: null,
      yearsExperience: null,
      skills: [],
      experience: [],
      education: [],
    };
    let page = 0;
    const repository = {
      readProjectionPage: vi.fn().mockImplementation(() => {
        page += 1;
        return Promise.resolve(page === 1 ? [projection] : []);
      }),
      count: vi.fn().mockResolvedValue(1),
    } as unknown as ProfilesRepository;
    const config = {
      getOrThrow: vi.fn().mockReturnValue('profiles-read'),
    } as unknown as ConfigService;
    const service = new ProfileIndexerService(client, repository, config);

    await expect(service.rebuild()).rejects.toThrow('bulk index item');
    expect(updateAliases).not.toHaveBeenCalled();
    expect(deleteIndex).toHaveBeenCalledWith(
      expect.objectContaining({ ignore_unavailable: true }),
    );
  });
});

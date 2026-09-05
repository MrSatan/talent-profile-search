import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Client } from '@elastic/elasticsearch';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/database/prisma.service';
import {
  ImporterService,
  type ImportReport,
} from '../src/ingestion/importer.service';
import { ProfileIndexerService } from '../src/search/profile-indexer.service';
import { ELASTICSEARCH_CLIENT } from '../src/search/search.tokens';

const TEST_INDEX_PATTERN = 'profiles-integration-*';
const PROFILE_CARD_KEYS = [
  'companyName',
  'country',
  'fullName',
  'id',
  'jobTitle',
  'linkedinUrl',
  'location',
  'matchedSkills',
  'matches',
  'skills',
  'summaryExcerpt',
  'yearsExperience',
].sort();
const PROFILE_DETAIL_KEYS = [
  'companyName',
  'country',
  'education',
  'experience',
  'fullName',
  'id',
  'industry',
  'jobTitle',
  'linkedinUrl',
  'location',
  'skills',
  'summary',
  'yearsExperience',
].sort();

describe('profile search integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let elasticsearch: Client;
  let firstImport: ImportReport;
  let secondImport: ImportReport;
  let indexedProfiles = 0;
  let concreteIndex = '';
  let previousIndexesRetained = 0;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    const config = app.get(ConfigService);
    configureApp(app, config.getOrThrow<string>('WEB_ORIGIN'));
    await app.init();

    prisma = app.get(PrismaService);
    elasticsearch = app.get<Client>(ELASTICSEARCH_CLIENT);
    await deleteIntegrationIndexes(elasticsearch);

    const importer = app.get(ImporterService);
    const datasetPath = config.getOrThrow<string>('DATASET_PATH');
    firstImport = await importer.import(datasetPath, { replace: true });
    secondImport = await importer.import(datasetPath);
    await app.get(ProfileIndexerService).rebuild();
    const reindex = await app.get(ProfileIndexerService).rebuild();
    indexedProfiles = reindex.indexedProfiles;
    concreteIndex = reindex.index;
    previousIndexesRetained = reindex.previousIndexesRetained;
  });

  afterAll(async () => {
    if (elasticsearch) {
      await deleteIntegrationIndexes(elasticsearch);
    }
    if (prisma) {
      await prisma.profileSkill.deleteMany();
      await prisma.profile.deleteMany();
      await prisma.skill.deleteMany();
    }
    await app?.close();
  });

  it('imports idempotently and rebuilds the search read model', async () => {
    expect(firstImport).toMatchObject({
      acceptedRows: 5,
      duplicateRows: 1,
      rejectedRows: 0,
      uniqueProfiles: 4,
      writtenProfiles: 4,
    });
    expect(secondImport).toMatchObject({
      acceptedRows: 5,
      duplicateRows: 1,
      rejectedRows: 0,
      uniqueProfiles: 4,
      writtenProfiles: 4,
    });
    await expect(prisma.profile.count()).resolves.toBe(4);
    await expect(prisma.profileSkill.count()).resolves.toBe(23);
    expect(indexedProfiles).toBe(4);
    expect(concreteIndex).toMatch(/^profiles-integration-\d{17}-[a-f0-9]{8}$/u);
    expect(previousIndexesRetained).toBe(1);

    const aliased = await elasticsearch.indices.getAlias({
      name: 'profiles-integration-read',
    });
    expect(Object.keys(aliased)).toEqual([concreteIndex]);

    const concreteIndexes = await elasticsearch.indices.get({
      index: TEST_INDEX_PATTERN,
      expand_wildcards: 'all',
    });
    expect(Object.keys(concreteIndexes)).toHaveLength(2);
  });

  it('returns only the approved profile-card contract', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/profiles')
      .expect(200);

    expect(response.body.items).toHaveLength(4);
    for (const item of response.body.items as Array<Record<string, unknown>>) {
      expect(Object.keys(item).sort()).toEqual(PROFILE_CARD_KEYS);
    }
    expect(JSON.stringify(response.body)).not.toMatch(
      /email|phone|street|birth|gender|salary|source[_-]?path/iu,
    );
  });

  it('returns the complete approved professional profile from PostgreSQL', async () => {
    const search = await request(app.getHttpServer())
      .get('/api/v1/profiles')
      .query({ q: 'Nika Rahimi' })
      .expect(200);
    const id = search.body.items[0].id as string;

    const response = await request(app.getHttpServer())
      .get(`/api/v1/profiles/${id}`)
      .expect(200);

    expect(Object.keys(response.body).sort()).toEqual(PROFILE_DETAIL_KEYS);
    expect(response.body).toMatchObject({
      fullName: 'Nika Rahimi',
      industry: 'software',
    });
    expect(response.body.skills).toEqual(
      expect.arrayContaining([
        'docker',
        'elasticsearch',
        'postgresql',
        'typescript',
      ]),
    );
    expect(response.body.experience[0]).toHaveProperty('description');
    expect(response.body.education[0]).toHaveProperty('institution');
    expect(JSON.stringify(response.body)).not.toMatch(
      /email|phone|street|birth|gender|salary|source[_-]?path/iu,
    );
  });

  it('combines repeated skill, title, and location filters', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/profiles')
      .query({
        skills: ['typescript', 'elasticsearch'],
        title: 'Senior',
        location: 'Tehran, Iran',
      })
      .expect(200);

    expect(response.body.meta.total).toBe(1);
    expect(response.body.items[0]).toMatchObject({
      fullName: 'Nika Rahimi',
      location: 'Tehran, Iran',
    });
  });

  it('returns facets for the currently filtered result set', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/profiles')
      .query({ title: 'Search Engineer', location: 'Austin, United States' })
      .expect(200);

    expect(response.body.meta.total).toBe(1);
    expect(response.body.facets.skills).toEqual(
      expect.arrayContaining([
        { value: 'elasticsearch', count: 1, selected: false },
        { value: 'react', count: 1, selected: false },
        { value: 'typescript', count: 1, selected: false },
      ]),
    );
    expect(response.body.facets.locations).toEqual([
      { value: 'austin, united states', count: 1, selected: true },
    ]);
  });

  it('supports cross-field and typo-tolerant keyword search', async () => {
    const crossField = await request(app.getHttpServer())
      .get('/api/v1/profiles')
      .query({ q: 'Signal Engineer' })
      .expect(200);
    expect(crossField.body.items[0]).toMatchObject({
      fullName: 'Mina Soltani',
    });

    const typo = await request(app.getHttpServer())
      .get('/api/v1/profiles')
      .query({ q: 'elastisearch' })
      .expect(200);
    expect(typo.body.meta.total).toBe(2);
  });

  it('promotes a keyword-matching skill that would otherwise be hidden', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/profiles')
      .query({ q: 'python' })
      .expect(200);

    expect(response.body.items[0]).toMatchObject({
      fullName: 'Arman Daryan',
      matchedSkills: ['python'],
      matches: expect.arrayContaining([{ field: 'skills', excerpt: null }]),
    });
    expect(response.body.items[0].skills).toHaveLength(13);
    expect(response.body.items[0].skills[0]).toBe('python');
  });

  it('returns a safe excerpt explaining a hidden-field match', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/profiles')
      .query({ q: 'Creates clear' })
      .expect(200);

    const profile = response.body.items.find(
      (item: { fullName: string }) => item.fullName === 'Laleh Moradi',
    );
    expect(profile.matches).toEqual(
      expect.arrayContaining([
        {
          field: 'experience',
          excerpt: expect.stringMatching(/Creates clear product experiences/iu),
        },
      ]),
    );
  });

  it('rejects ambiguous and unknown query parameters', async () => {
    const commaSeparated = await request(app.getHttpServer())
      .get('/api/v1/profiles')
      .query({ skills: 'typescript,elasticsearch' })
      .expect(400);
    expect(commaSeparated.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: 'The request parameters are invalid.',
    });

    const unknown = await request(app.getHttpServer())
      .get('/api/v1/profiles')
      .query({ privateEmail: 'not-returned@example.test' })
      .expect(400);
    expect(unknown.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(JSON.stringify(unknown.body)).not.toContain('not-returned');
  });

  it('treats special characters as search text, not query syntax', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/profiles')
      .query({ q: 'C++ (platform) [search] / "safe" ?' })
      .expect(200);

    expect(response.body).toHaveProperty('items');
    expect(response.body).toHaveProperty('facets');
  });
});

async function deleteIntegrationIndexes(client: Client): Promise<void> {
  const exists = await client.indices.exists({ index: TEST_INDEX_PATTERN });
  if (!exists) {
    return;
  }
  const indexes = await client.indices.get({
    index: TEST_INDEX_PATTERN,
    expand_wildcards: 'all',
  });
  await Promise.all(
    Object.keys(indexes).map((index) => client.indices.delete({ index })),
  );
}

import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Client } from '@elastic/elasticsearch';
import { ProfilesRepository } from '../profiles/profiles.repository';
import { toProfileSearchDocument } from './profile-document.mapper';
import { profileIndexDefinition } from './profile-index.definition';
import { ELASTICSEARCH_CLIENT } from './search.tokens';

export interface ReindexReport {
  index: string;
  indexedProfiles: number;
  previousIndexesRetained: number;
}

@Injectable()
export class ProfileIndexerService {
  private readonly alias: string;
  private readonly indexPrefix: string;

  constructor(
    @Inject(ELASTICSEARCH_CLIENT) private readonly client: Client,
    @Inject(ProfilesRepository)
    private readonly profilesRepository: ProfilesRepository,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.alias = config.getOrThrow<string>('ELASTICSEARCH_INDEX_ALIAS');
    this.indexPrefix = indexPrefixForAlias(this.alias);
  }

  async rebuild(): Promise<ReindexReport> {
    const index = versionedIndexName(this.indexPrefix);
    let aliasSwapped = false;
    let previousIndexes: string[] = [];

    try {
      await this.client.indices.create({
        index,
        ...profileIndexDefinition,
      } as never);

      let cursor: string | null = null;
      let indexedProfiles = 0;
      while (true) {
        const page = await this.profilesRepository.readProjectionPage(
          cursor,
          100,
        );
        if (page.length === 0) {
          break;
        }
        const operations = page.flatMap((profile) => [
          { index: { _index: index, _id: profile.id } },
          toProfileSearchDocument(profile),
        ]);
        const response = await this.client.bulk({ operations });
        if (response.errors) {
          throw new Error('A bulk index item was rejected');
        }
        indexedProfiles += page.length;
        cursor = page.at(-1)?.id ?? null;
      }

      await this.client.indices.refresh({ index });
      const [databaseCount, searchCount] = await Promise.all([
        this.profilesRepository.count(),
        this.client.count({ index }),
      ]);
      if (
        databaseCount !== searchCount.count ||
        databaseCount !== indexedProfiles
      ) {
        throw new Error('Index document count verification failed');
      }

      const smoke = await this.client.search({
        index,
        size: databaseCount > 0 ? 1 : 0,
        query: { match_all: {} },
      });
      if (databaseCount > 0 && smoke.hits.hits.length !== 1) {
        throw new Error('Index smoke search failed');
      }

      previousIndexes = await this.currentAliasIndexes();
      await this.client.indices.updateAliases({
        actions: [
          ...previousIndexes.map((oldIndex) => ({
            remove: { index: oldIndex, alias: this.alias },
          })),
          { add: { index, alias: this.alias } },
        ],
      });
      aliasSwapped = true;
      const retained = await this.cleanupOldIndexes(index, previousIndexes);
      return {
        index,
        indexedProfiles,
        previousIndexesRetained: retained,
      };
    } catch (error) {
      if (!aliasSwapped) {
        await this.client.indices
          .delete({ index, ignore_unavailable: true })
          .catch(() => undefined);
      }
      throw error;
    }
  }

  private async currentAliasIndexes(): Promise<string[]> {
    const exists = await this.client.indices.existsAlias({ name: this.alias });
    if (!exists) {
      return [];
    }
    const aliases = await this.client.indices.getAlias({ name: this.alias });
    return Object.keys(aliases);
  }

  private async cleanupOldIndexes(
    currentIndex: string,
    previousIndexes: string[],
  ): Promise<number> {
    const previousToKeep = [...previousIndexes]
      .filter((name) => name !== currentIndex)
      .sort()
      .at(-1);
    const all = await this.client.indices.get({
      index: `${this.indexPrefix}-*`,
      expand_wildcards: 'all',
    });
    const keep = new Set([
      currentIndex,
      ...(previousToKeep ? [previousToKeep] : []),
    ]);
    const obsolete = Object.keys(all).filter((name) => !keep.has(name));
    if (obsolete.length > 0) {
      await this.client.indices.delete({ index: obsolete });
    }
    return previousToKeep ? 1 : 0;
  }
}

function indexPrefixForAlias(alias: string): string {
  return alias.endsWith('-read') ? alias.slice(0, -'-read'.length) : alias;
}

function versionedIndexName(prefix: string): string {
  const timestamp = new Date().toISOString().replace(/\D/gu, '').slice(0, 17);
  return `${prefix}-${timestamp}-${randomUUID().slice(0, 8)}`;
}

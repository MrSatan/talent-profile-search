import { access } from 'node:fs/promises';
import { Inject, Injectable } from '@nestjs/common';
import { ProfilesRepository } from '../profiles/profiles.repository';
import { readCsvRecords } from './csv-reader';
import {
  deduplicateProfiles,
  isHeaderRecord,
  mapProfileRecord,
  type RejectionReason,
} from './row-mappers';

export interface ImportOptions {
  dryRun?: boolean;
  replace?: boolean;
}

export interface ImportReport {
  logicalRecords: number;
  sourcePrefixesRemoved: number;
  repairedRecords: number;
  headerRecords: number;
  continuationRecords: number;
  acceptedRows: number;
  uniqueProfiles: number;
  duplicateRows: number;
  conflicts: number;
  rejectedRows: number;
  rejectionReasons: Partial<Record<RejectionReason, number>>;
  writtenProfiles: number;
  dryRun: boolean;
  replace: boolean;
}

export class ImportValidationError extends Error {
  constructor(readonly report: ImportReport) {
    super('Dataset validation failed; no database writes were attempted.');
    this.name = 'ImportValidationError';
  }
}

@Injectable()
export class ImporterService {
  constructor(
    @Inject(ProfilesRepository)
    private readonly profilesRepository: ProfilesRepository,
  ) {}

  async import(
    filePath: string,
    options: ImportOptions = {},
  ): Promise<ImportReport> {
    await access(filePath);
    const { records, sourcePrefixesRemoved, repairedRecords } =
      await readCsvRecords(filePath);
    let header: string[] | null = null;
    let headerRecords = 0;
    let continuationRecords = 0;
    const accepted = [];
    const rejectionReasons: Partial<Record<RejectionReason, number>> = {};

    for (const record of records) {
      if (isHeaderRecord(record)) {
        header ??= record;
        headerRecords += 1;
        continue;
      }
      const mappedRecord = mapProfileRecord(record, header);
      if (mappedRecord.continuationArtifact) {
        continuationRecords += 1;
        continue;
      }
      for (const result of mappedRecord.rows) {
        if (result.profile) {
          accepted.push(result.profile);
        } else {
          rejectionReasons[result.reason] =
            (rejectionReasons[result.reason] ?? 0) + 1;
        }
      }
    }

    const deduplicated = deduplicateProfiles(accepted);
    const rejectedRows = Object.values(rejectionReasons).reduce(
      (total, count) => total + (count ?? 0),
      0,
    );
    const baseReport: ImportReport = {
      logicalRecords: records.length,
      sourcePrefixesRemoved,
      repairedRecords,
      headerRecords,
      continuationRecords,
      acceptedRows: accepted.length,
      uniqueProfiles: deduplicated.profiles.length,
      duplicateRows: deduplicated.duplicateRows,
      conflicts: deduplicated.conflicts,
      rejectedRows,
      rejectionReasons,
      writtenProfiles: 0,
      dryRun: options.dryRun ?? false,
      replace: options.replace ?? false,
    };

    if (rejectedRows > 0) {
      throw new ImportValidationError(baseReport);
    }
    if (options.dryRun) {
      return baseReport;
    }

    const writtenProfiles = await this.profilesRepository.importProfiles(
      deduplicated.profiles,
      options.replace ?? false,
    );
    return { ...baseReport, writtenProfiles };
  }
}

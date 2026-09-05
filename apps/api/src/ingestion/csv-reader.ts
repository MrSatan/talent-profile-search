import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { parse } from 'csv-parse/sync';

const SOURCE_PREFIX = /^[A-Za-z]:\\+.*?\.csv\(\d+\): ?/u;
const PROFILE_URL = /^\s*"?(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\//iu;

export interface CsvReadResult {
  records: string[][];
  sourcePrefixesRemoved: number;
  repairedRecords: number;
}

export async function readCsvRecords(filePath: string): Promise<CsvReadResult> {
  const lines = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  const logicalRecords: string[] = [];
  let currentRecord: string | null = null;
  let sourcePrefixesRemoved = 0;

  for await (const rawLine of lines) {
    const hasPrefix = SOURCE_PREFIX.test(rawLine);
    const line = hasPrefix ? rawLine.replace(SOURCE_PREFIX, '') : rawLine;
    if (hasPrefix) {
      sourcePrefixesRemoved += 1;
    }

    if (isRecordStart(line)) {
      if (currentRecord !== null) {
        logicalRecords.push(currentRecord);
      }
      currentRecord = line;
    } else if (currentRecord !== null) {
      currentRecord += `\n${line}`;
    } else if (line.trim()) {
      // A non-empty preamble is retained so the mapper can reject it safely.
      logicalRecords.push(line);
    }
  }
  if (currentRecord !== null) {
    logicalRecords.push(currentRecord);
  }

  const records: string[][] = [];
  let repairedRecords = 0;
  for (const record of logicalRecords) {
    const parsed = parseRecord(record);
    records.push(...parsed.rows);
    repairedRecords += parsed.repaired ? 1 : 0;
  }
  return { records, sourcePrefixesRemoved, repairedRecords };
}

function isRecordStart(line: string): boolean {
  if (line.startsWith('full_name,')) {
    return true;
  }
  const earlyFields = line.split(',', 9);
  return [1, 4, 5, 7].some((index) =>
    PROFILE_URL.test(earlyFields[index] ?? ''),
  );
}

function parseRecord(record: string): { rows: string[][]; repaired: boolean } {
  try {
    const parsed = parse(record, {
      bom: true,
      quote: '"',
      escape: '"',
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: false,
    }) as unknown;
    if (!Array.isArray(parsed)) {
      return { rows: [], repaired: false };
    }
    return {
      rows: parsed.filter(
        (row): row is string[] =>
          Array.isArray(row) && row.every((field) => typeof field === 'string'),
      ),
      repaired: false,
    };
  } catch {
    return { rows: [parseRelaxedCsvRecord(record)], repaired: true };
  }
}

function parseRelaxedCsvRecord(record: string): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < record.length; index += 1) {
    const character = record[index];
    if (quoted) {
      if (character === '"') {
        if (record[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (
          record[index + 1] === ',' ||
          record[index + 1] === undefined
        ) {
          quoted = false;
        } else {
          field += character;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === ',') {
      fields.push(field);
      field = '';
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === '\n' || character === '\r') {
      field += ' ';
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

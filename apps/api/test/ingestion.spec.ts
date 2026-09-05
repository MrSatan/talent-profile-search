import { resolve } from 'node:path';
import { readCsvRecords } from '../src/ingestion/csv-reader';
import {
  canonicalizeLinkedinUrl,
  isNumericRangeOrCompensation,
  normalizeKey,
  sanitizeProfessionalText,
  toCanonicalSkill,
} from '../src/ingestion/normalizer';
import { parsePythonLiteral } from '../src/ingestion/python-literal.parser';
import {
  deduplicateProfiles,
  isHeaderRecord,
  mapProfileRecord,
} from '../src/ingestion/row-mappers';

describe('ingestion boundary', () => {
  it('parses data literals without executing expressions', () => {
    expect(
      parsePythonLiteral(
        "[{'name': 'TypeScript', 'active': True, 'value': None}]",
      ),
    ).toEqual([{ name: 'TypeScript', active: true, value: null }]);
    expect(parsePythonLiteral("__import__('node:fs').rmSync('/')")).toBeNull();
    expect(parsePythonLiteral('new Function("return 1")')).toBeNull();
  });

  it('normalizes identity and redacts contact/source text', () => {
    expect(
      canonicalizeLinkedinUrl(
        'linkedin.com/in/example-person/?tracking=private#section',
      ),
    ).toBe('https://www.linkedin.com/in/example-person');
    expect(canonicalizeLinkedinUrl('linkedin.com/company/example')).toBeNull();
    expect(normalizeKey('  TýpeScript  Platform ')).toBe('typescript platform');
    expect(isNumericRangeOrCompensation('$120,000 - $150,000')).toBe(true);
    expect(toCanonicalSkill('80k-100k')).toBeNull();
    const safe = sanitizeProfessionalText(
      'Reach me at person@example.test or +1 (555) 123-4567 from C:\\private\\row.csv',
      500,
    );
    expect(safe).not.toMatch(/@|555|private\\row/iu);
  });

  it('maps and deterministically deduplicates the synthetic fixture', async () => {
    const fixture = resolve(
      process.cwd(),
      '../../data/fixtures/profiles.synthetic.csv',
    );
    const { records, repairedRecords } = await readCsvRecords(fixture);
    const header = records[0] ?? null;
    expect(header && isHeaderRecord(header)).toBe(true);
    expect(repairedRecords).toBe(0);

    const profiles = records.slice(1).flatMap((record) => {
      const mapped = mapProfileRecord(record, header);
      expect(mapped.continuationArtifact).toBe(false);
      return mapped.rows.flatMap((row) => (row.profile ? [row.profile] : []));
    });
    const result = deduplicateProfiles(profiles);
    expect(result.profiles).toHaveLength(4);
    expect(result.duplicateRows).toBe(1);
    const nika = result.profiles.find((profile) =>
      profile.linkedinUrl.endsWith('/synthetic-nika-rahimi'),
    );
    expect(nika?.skills.map((skill) => skill.normalizedName)).toEqual([
      'docker',
      'elasticsearch',
      'postgresql',
      'typescript',
    ]);
    expect(Object.keys(nika ?? {})).not.toContain('emails');
    expect(JSON.stringify(nika)).not.toMatch(/street_address|phone_numbers/iu);
  });

  it('uses structural anchors when a same-width row disagrees with its header', () => {
    const header = syntheticExtendedHeader();
    const record = syntheticExtendedRecord();
    header[18] = 'experience';
    header[19] = 'education';
    header[13] = 'skills';
    record[18] = '[]';
    record[19] = '[]';
    record[13] = "['not a professional skill']";

    const result = mapProfileRecord(record, header);
    const profile = result.rows[0]?.profile;

    expect(profile).toMatchObject({
      jobTitle: 'Platform Engineer',
      companyName: 'Example Systems',
      summary: 'Builds dependable systems.',
      yearsExperience: 9,
    });
    expect(profile?.skills.map((skill) => skill.name)).toEqual([
      'Distributed Systems',
    ]);
  });

  it('rejects collection and numeric-range literals in scalar role fields', () => {
    const header = syntheticExtendedHeader();
    const record = syntheticExtendedRecord();
    header[15] = 'experience';
    header[16] = 'education';
    header[10] = 'skills';
    header[7] = 'job_title';
    header[8] = 'job_company_name';
    header[12] = 'location_name';
    header[14] = 'location_country';
    record[7] = "['manager']";
    record[8] = '51-200';
    record[12] = '$120,000 - $150,000';
    record[14] = 'USD 120000 to 150000';

    const result = mapProfileRecord(record, header);

    expect(result.rows[0]?.profile).toMatchObject({
      jobTitle: 'Platform Engineer',
      companyName: 'Example Systems',
      location: null,
      country: null,
    });
  });
});

function syntheticExtendedHeader(): string[] {
  return Array.from({ length: 21 }, (_, index) => `unused_${index}`).map(
    (name, index) =>
      ({
        0: 'full_name',
        1: 'first_name',
        2: 'last_name',
        4: 'linkedin_url',
      })[index] ?? name,
  );
}

function syntheticExtendedRecord(): string[] {
  const record = Array.from({ length: 21 }, () => '');
  record[0] = 'Synthetic Person';
  record[1] = 'Synthetic';
  record[2] = 'Person';
  record[4] = 'linkedin.com/in/synthetic-structural-person';
  record[5] = '9';
  record[6] = 'Builds dependable systems.';
  record[10] = "['Distributed Systems']";
  record[15] =
    "[{'company': {'name': 'Example Systems', 'industry': 'Software'}, 'location_names': ['Example City, Example Country'], 'end_date': None, 'start_date': '2017-01', 'title': {'name': 'Platform Engineer'}, 'is_primary': True, 'summary': 'Builds dependable systems.'}]";
  record[16] =
    "[{'school': {'name': 'Example University'}, 'end_date': '2016', 'start_date': '2012', 'degrees': ['Bachelor of Science'], 'majors': ['Computer Science']}]";
  return record;
}

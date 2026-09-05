import type {
  CanonicalProfile,
  CanonicalSkill,
  EducationRecord,
  EmploymentRecord,
} from '../profiles/profile.types';
import {
  canonicalizeLinkedinUrl,
  cleanDisplayString,
  isNumericRangeOrCompensation,
  normalizeKey,
  normalizePartialDate,
  parseYear,
  parseYearsExperience,
  sanitizeProfessionalText,
  toCanonicalSkill,
} from './normalizer';
import { isLiteralObject, parsePythonLiteral } from './python-literal.parser';

export type RejectionReason =
  | 'INVALID_FULL_NAME'
  | 'INVALID_LINKEDIN_URL'
  | 'INVALID_NESTED_LITERAL'
  | 'UNSUPPORTED_LAYOUT';

export type RowMappingResult =
  | { profile: CanonicalProfile; reason?: never }
  | { profile?: never; reason: RejectionReason };

export interface RecordMappingResult {
  rows: RowMappingResult[];
  continuationArtifact: boolean;
}

interface HeaderLookup {
  get(name: string): string | undefined;
  has(name: string): boolean;
}

interface MappedEmployment {
  records: EmploymentRecord[];
  currentIndex: number | null;
  industries: Array<string | null>;
}

export function isHeaderRecord(record: string[]): boolean {
  const normalized = new Set(record.map((field) => normalizeKey(field)));
  return normalized.has('full_name') && normalized.has('linkedin_url');
}

export function mapProfileRow(
  record: string[],
  header: string[] | null,
): RowMappingResult {
  const detectedExperienceIndex = findExperienceIndex(record);
  if (
    header &&
    header.length === record.length &&
    (detectedExperienceIndex < 0 ||
      findHeaderIndex(header, 'experience') === detectedExperienceIndex)
  ) {
    const mapped = mapHeaderAlignedRow(record, header);
    if (mapped) {
      return mapped;
    }
  }
  return mapStructurallyAnchoredRow(record);
}

export function mapProfileRecord(
  record: string[],
  header: string[] | null,
): RecordMappingResult {
  const urlIndexes = record.flatMap((field, index) =>
    canonicalizeLinkedinUrl(field) ? [index] : [],
  );

  if (urlIndexes.length === 0) {
    const hasTrailingProjection = record.some(
      (field) =>
        /["']current_version["']\s*:/u.test(field) ||
        (/["']network["']\s*:/u.test(field) &&
          field.includes('linkedin.com/in/')),
    );
    const continuationArtifact =
      record.length <= 10 || (record.length < 60 && hasTrailingProjection);
    return {
      rows: continuationArtifact ? [] : [{ reason: 'INVALID_LINKEDIN_URL' }],
      continuationArtifact,
    };
  }

  if (urlIndexes.length === 1) {
    return {
      rows: [mapProfileRow(record, header)],
      continuationArtifact: false,
    };
  }

  const starts = urlIndexes.map((urlIndex) =>
    findFullNameIndex(record, urlIndex),
  );
  if (starts.some((index) => index < 0)) {
    return {
      rows: [{ reason: 'UNSUPPORTED_LAYOUT' }],
      continuationArtifact: false,
    };
  }

  return {
    rows: starts.map((start, index) => {
      const end = starts[index + 1] ?? record.length;
      return mapProfileRow(record.slice(start, end), null);
    }),
    continuationArtifact: false,
  };
}

function mapHeaderAlignedRow(
  record: string[],
  header: string[],
): RowMappingResult | null {
  const lookup = createHeaderLookup(record, header);
  if (
    !lookup.has('full_name') ||
    !lookup.has('linkedin_url') ||
    !lookup.has('skills') ||
    !lookup.has('experience') ||
    !lookup.has('education')
  ) {
    return null;
  }

  const linkedinUrl = canonicalizeLinkedinUrl(lookup.get('linkedin_url'));
  const experienceLiteral = parsePythonLiteral(lookup.get('experience'));
  const educationLiteral = parsePythonLiteral(lookup.get('education'));
  const skillsLiteral = parsePythonLiteral(lookup.get('skills'));

  // A heterogeneous source row that does not satisfy its active header must be
  // routed through the explicit structural mapper instead of shifted by name.
  if (
    !linkedinUrl ||
    !Array.isArray(experienceLiteral) ||
    !Array.isArray(educationLiteral) ||
    !Array.isArray(skillsLiteral)
  ) {
    return null;
  }

  const employment = mapEmployment(experienceLiteral);
  const current =
    employment.currentIndex === null
      ? null
      : (employment.records[employment.currentIndex] ?? null);
  const industry =
    employment.currentIndex === null
      ? null
      : (employment.industries[employment.currentIndex] ?? null);

  return buildProfile({
    linkedinUrl,
    linkedinId: cleanIdentifier(lookup.get('linkedin_id')),
    fullName: lookup.get('full_name'),
    jobTitle:
      cleanProfessionalLabel(lookup.get('job_title'), 200) ?? current?.jobTitle,
    companyName:
      cleanProfessionalLabel(lookup.get('job_company_name'), 200) ??
      current?.companyName,
    industry: cleanScalarString(lookup.get('industry'), 200) ?? industry,
    location: lookup.get('location_name'),
    country: lookup.get('location_country'),
    summary: lookup.get('summary'),
    yearsExperience: lookup.get('inferred_years_experience'),
    skillsLiteral,
    employment,
    educationLiteral,
  });
}

function mapStructurallyAnchoredRow(record: string[]): RowMappingResult {
  const urlIndex = record.findIndex(
    (field, index) => index < 24 && canonicalizeLinkedinUrl(field) !== null,
  );
  if (urlIndex < 0) {
    return { reason: 'INVALID_LINKEDIN_URL' };
  }
  const linkedinUrl = canonicalizeLinkedinUrl(record[urlIndex]);
  if (!linkedinUrl) {
    return { reason: 'INVALID_LINKEDIN_URL' };
  }

  const experienceIndex = findExperienceIndex(record);
  if (experienceIndex < 10) {
    return { reason: 'UNSUPPORTED_LAYOUT' };
  }
  const educationIndex = experienceIndex + 1;
  const skillsIndex = experienceIndex - 5;
  const yearsIndex = experienceIndex - 10;
  const summaryIndex = experienceIndex - 9;

  const experienceLiteral = parsePythonLiteral(record[experienceIndex]);
  const educationLiteral = parsePythonLiteral(record[educationIndex]);
  const skillsLiteral = parsePythonLiteral(record[skillsIndex]);
  if (
    !Array.isArray(experienceLiteral) ||
    !Array.isArray(educationLiteral) ||
    !Array.isArray(skillsLiteral)
  ) {
    return { reason: 'INVALID_NESTED_LITERAL' };
  }

  const fullNameIndex = findFullNameIndex(record, urlIndex);
  if (fullNameIndex < 0) {
    return { reason: 'INVALID_FULL_NAME' };
  }

  const employment = mapEmployment(experienceLiteral);
  const current =
    employment.currentIndex === null
      ? null
      : (employment.records[employment.currentIndex] ?? null);
  const currentIndustry =
    employment.currentIndex === null
      ? null
      : (employment.industries[employment.currentIndex] ?? null);
  const location = findBroadLocation(record, experienceIndex, urlIndex);

  return buildProfile({
    linkedinUrl,
    linkedinId: cleanIdentifier(record[urlIndex + 2]),
    fullName: record[fullNameIndex],
    jobTitle: current?.jobTitle,
    companyName: current?.companyName,
    industry: currentIndustry,
    location,
    country: countryFromLocation(location),
    summary: record[summaryIndex],
    yearsExperience: record[yearsIndex],
    skillsLiteral,
    employment,
    educationLiteral,
  });
}

function buildProfile(input: {
  linkedinUrl: string;
  linkedinId: string | null;
  fullName: unknown;
  jobTitle: unknown;
  companyName: unknown;
  industry: unknown;
  location: unknown;
  country: unknown;
  summary: unknown;
  yearsExperience: unknown;
  skillsLiteral: unknown[];
  employment: MappedEmployment;
  educationLiteral: unknown[];
}): RowMappingResult {
  const fullName = cleanDisplayString(input.fullName, 200);
  if (!fullName) {
    return { reason: 'INVALID_FULL_NAME' };
  }

  const location = cleanLocation(input.location, 200);
  const skills = mapSkills(input.skillsLiteral);
  const education = mapEducation(input.educationLiteral);
  return {
    profile: {
      linkedinUrl: input.linkedinUrl,
      linkedinId: input.linkedinId,
      fullName,
      jobTitle: cleanProfessionalLabel(input.jobTitle, 200),
      companyName: cleanProfessionalLabel(input.companyName, 200),
      industry: cleanScalarString(input.industry, 200),
      location,
      normalizedLocation: location ? normalizeKey(location) : null,
      country: cleanLocation(input.country, 100),
      summary: isCollectionLiteral(input.summary)
        ? null
        : sanitizeProfessionalText(input.summary, 4_000),
      yearsExperience: parseYearsExperience(input.yearsExperience),
      experience: input.employment.records,
      education,
      skills,
    },
  };
}

function findHeaderIndex(header: string[], name: string): number {
  return header.findIndex((field) => normalizeKey(field) === name);
}

function cleanScalarString(
  value: unknown,
  maximumLength: number,
): string | null {
  return isCollectionLiteral(value)
    ? null
    : cleanDisplayString(value, maximumLength);
}

function cleanProfessionalLabel(
  value: unknown,
  maximumLength: number,
): string | null {
  const cleaned = cleanScalarString(value, maximumLength);
  return cleaned &&
    !/^(?:19|20)\d{2}$/u.test(cleaned) &&
    !isNumericRangeOrCompensation(cleaned)
    ? cleaned
    : null;
}

function cleanLocation(value: unknown, maximumLength: number): string | null {
  const cleaned = cleanScalarString(value, maximumLength);
  return cleaned && !isNumericRangeOrCompensation(cleaned) ? cleaned : null;
}

function isCollectionLiteral(value: unknown): boolean {
  if (
    typeof value !== 'string' ||
    !['[', '{', '('].some((prefix) => value.trimStart().startsWith(prefix))
  ) {
    return false;
  }
  const literal = parsePythonLiteral(value);
  return Array.isArray(literal) || isLiteralObject(literal);
}

function createHeaderLookup(record: string[], header: string[]): HeaderLookup {
  const indexes = new Map(
    header.map((name, index) => [normalizeKey(name), index] as const),
  );
  return {
    get(name: string): string | undefined {
      const index = indexes.get(name);
      return index === undefined ? undefined : record[index];
    },
    has(name: string): boolean {
      return indexes.has(name);
    },
  };
}

function findExperienceIndex(record: string[]): number {
  const direct = record.findIndex(
    (field) =>
      /^\s*\[/u.test(field) &&
      /["']company["']\s*:/u.test(field) &&
      /["']title["']\s*:/u.test(field),
  );
  if (direct >= 0) {
    return direct;
  }

  const educationIndex = record.findIndex(
    (field) => /^\s*\[/u.test(field) && /["']school["']\s*:/u.test(field),
  );
  if (
    educationIndex > 0 &&
    Array.isArray(parsePythonLiteral(record[educationIndex - 1]))
  ) {
    return educationIndex - 1;
  }

  const versionIndex = record.findIndex(
    (field) =>
      /^\s*\{/u.test(field) &&
      /["']status["']\s*:/u.test(field) &&
      /["']current_version["']\s*:/u.test(field),
  );
  const inferred = versionIndex - 5;
  return inferred >= 0 && Array.isArray(parsePythonLiteral(record[inferred]))
    ? inferred
    : -1;
}

function findFullNameIndex(record: string[], urlIndex: number): number {
  for (let index = 0; index <= urlIndex - 3; index += 1) {
    const full = cleanDisplayString(record[index], 200);
    const first = cleanDisplayString(record[index + 1], 100);
    const last = cleanDisplayString(record[index + 2], 100);
    if (
      full &&
      first &&
      last &&
      normalizeKey(full) === normalizeKey(`${first} ${last}`)
    ) {
      return index;
    }
  }

  return record.findIndex((field, index) => {
    const value = cleanDisplayString(field, 200);
    return (
      index < urlIndex &&
      Boolean(value?.includes(' ')) &&
      !/[\\/@]/u.test(value ?? '') &&
      !/^[A-Za-z0-9_-]+_\d{4}$/u.test(value ?? '')
    );
  });
}

function findBroadLocation(
  record: string[],
  experienceIndex: number,
  urlIndex: number,
): string | null {
  const start = Math.max(urlIndex + 3, experienceIndex - 24);
  const end = Math.max(start, experienceIndex - 11);
  const candidates: Array<{ value: string; score: number; index: number }> = [];

  for (let index = start; index <= end; index += 1) {
    const value = cleanLocation(record[index], 200);
    if (
      !value ||
      !value.includes(',') ||
      value.includes('[') ||
      value.includes(']') ||
      /[{}@]/u.test(value) ||
      /(?:linkedin\.com|facebook\.com|twitter\.com)/iu.test(value) ||
      /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/u.test(value) ||
      /\d{4}-\d{2}/u.test(value)
    ) {
      continue;
    }
    const parts = value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    candidates.push({ value, score: parts.length, index });
  }

  candidates.sort(
    (left, right) => right.score - left.score || right.index - left.index,
  );
  return candidates[0]?.value ?? null;
}

function countryFromLocation(location: string | null): string | null {
  if (!location) {
    return null;
  }
  const parts = location
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return cleanDisplayString(parts.at(-1), 100);
}

function mapSkills(values: unknown[]): CanonicalSkill[] {
  const skills = new Map<string, CanonicalSkill>();
  for (const value of values) {
    const skill = toCanonicalSkill(value);
    if (skill && !skills.has(skill.normalizedName)) {
      skills.set(skill.normalizedName, skill);
    }
  }
  return [...skills.values()].sort((left, right) =>
    left.normalizedName.localeCompare(right.normalizedName),
  );
}

function mapEmployment(values: unknown[]): MappedEmployment {
  const records: EmploymentRecord[] = [];
  const industries: Array<string | null> = [];
  let currentIndex: number | null = null;

  for (const value of values.slice(0, 100)) {
    if (!isLiteralObject(value)) {
      continue;
    }
    const company = isLiteralObject(value.company) ? value.company : null;
    const title = isLiteralObject(value.title) ? value.title : null;
    const companyLocation =
      company && isLiteralObject(company.location) ? company.location : null;
    const locationNames = Array.isArray(value.location_names)
      ? value.location_names
      : [];
    const jobTitle = cleanDisplayString(title?.name, 200);
    const companyName = cleanDisplayString(company?.name, 200);
    const location =
      cleanDisplayString(locationNames[0], 200) ??
      cleanDisplayString(companyLocation?.name, 200);
    const startDate = normalizePartialDate(value.start_date);
    const endDate = normalizePartialDate(value.end_date);
    const isCurrent =
      typeof value.is_primary === 'boolean' ? value.is_primary : null;
    const description = sanitizeProfessionalText(value.summary, 2_000);

    if (!jobTitle && !companyName && !startDate && !description) {
      continue;
    }
    records.push({
      jobTitle,
      companyName,
      location,
      startDate,
      endDate,
      isCurrent,
      description,
    });
    industries.push(cleanDisplayString(company?.industry, 200));
    if (isCurrent === true) {
      currentIndex = records.length - 1;
    }
  }

  if (currentIndex === null && records.length > 0) {
    const openIndex = records.findIndex(
      (record) => record.endDate === null && record.startDate !== null,
    );
    currentIndex = openIndex >= 0 ? openIndex : 0;
  }
  return { records, currentIndex, industries };
}

function mapEducation(values: unknown[]): EducationRecord[] {
  const records: EducationRecord[] = [];
  for (const value of values.slice(0, 50)) {
    if (!isLiteralObject(value)) {
      continue;
    }
    const school = isLiteralObject(value.school) ? value.school : null;
    const institution = cleanDisplayString(school?.name, 200);
    if (!institution) {
      continue;
    }
    const degrees = Array.isArray(value.degrees) ? value.degrees : [];
    const majors = Array.isArray(value.majors) ? value.majors : [];
    records.push({
      institution,
      degree: cleanDisplayString(degrees[0], 200),
      fieldOfStudy: cleanDisplayString(majors[0], 200),
      startYear: parseYear(value.start_date),
      endYear: parseYear(value.end_date),
    });
  }
  return records;
}

function cleanIdentifier(value: unknown): string | null {
  const identifier = cleanDisplayString(value, 100);
  return identifier && /^[A-Za-z0-9_-]+$/u.test(identifier) ? identifier : null;
}

export interface DeduplicationResult {
  profiles: CanonicalProfile[];
  duplicateRows: number;
  conflicts: number;
}

export function deduplicateProfiles(
  input: CanonicalProfile[],
): DeduplicationResult {
  const profiles = new Map<string, CanonicalProfile>();
  let duplicateRows = 0;
  let conflicts = 0;

  for (const candidate of input) {
    const existing = profiles.get(candidate.linkedinUrl);
    if (!existing) {
      profiles.set(candidate.linkedinUrl, candidate);
      continue;
    }
    duplicateRows += 1;
    conflicts += countScalarConflicts(existing, candidate);
    profiles.set(candidate.linkedinUrl, mergeProfiles(existing, candidate));
  }

  return {
    profiles: [...profiles.values()].sort((left, right) =>
      left.linkedinUrl.localeCompare(right.linkedinUrl),
    ),
    duplicateRows,
    conflicts,
  };
}

function mergeProfiles(
  left: CanonicalProfile,
  right: CanonicalProfile,
): CanonicalProfile {
  const ordered = [left, right].sort((first, second) => {
    const scoreDifference = completeness(second) - completeness(first);
    return (
      scoreDifference ||
      JSON.stringify(first).localeCompare(JSON.stringify(second))
    );
  });
  const primary = ordered[0] ?? left;
  const secondary = ordered[1] ?? right;
  const skills = new Map(
    [...primary.skills, ...secondary.skills].map((skill) => [
      skill.normalizedName,
      skill,
    ]),
  );

  return {
    linkedinUrl: primary.linkedinUrl,
    linkedinId: primary.linkedinId ?? secondary.linkedinId,
    fullName: primary.fullName,
    jobTitle: primary.jobTitle ?? secondary.jobTitle,
    companyName: primary.companyName ?? secondary.companyName,
    industry: primary.industry ?? secondary.industry,
    location: primary.location ?? secondary.location,
    normalizedLocation:
      primary.normalizedLocation ?? secondary.normalizedLocation,
    country: primary.country ?? secondary.country,
    summary: primary.summary ?? secondary.summary,
    yearsExperience: primary.yearsExperience ?? secondary.yearsExperience,
    experience:
      primary.experience.length > 0 ? primary.experience : secondary.experience,
    education:
      primary.education.length > 0 ? primary.education : secondary.education,
    skills: [...skills.values()].sort((first, second) =>
      first.normalizedName.localeCompare(second.normalizedName),
    ),
  };
}

function completeness(profile: CanonicalProfile): number {
  const scalarValues = [
    profile.linkedinId,
    profile.fullName,
    profile.jobTitle,
    profile.companyName,
    profile.industry,
    profile.location,
    profile.country,
    profile.summary,
    profile.yearsExperience,
  ];
  return (
    scalarValues.filter((value) => value !== null && value !== '').length +
    Math.min(profile.skills.length, 10) +
    Math.min(profile.experience.length, 5) +
    Math.min(profile.education.length, 3)
  );
}

function countScalarConflicts(
  left: CanonicalProfile,
  right: CanonicalProfile,
): number {
  const keys: Array<
    keyof Pick<
      CanonicalProfile,
      | 'linkedinId'
      | 'fullName'
      | 'jobTitle'
      | 'companyName'
      | 'industry'
      | 'location'
      | 'country'
      | 'summary'
      | 'yearsExperience'
    >
  > = [
    'linkedinId',
    'fullName',
    'jobTitle',
    'companyName',
    'industry',
    'location',
    'country',
    'summary',
    'yearsExperience',
  ];
  return keys.filter(
    (key) =>
      left[key] !== null && right[key] !== null && left[key] !== right[key],
  ).length;
}

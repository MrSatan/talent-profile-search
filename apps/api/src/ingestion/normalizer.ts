import { decode } from 'he';

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/gu;
const SOURCE_PATH_PATTERN = /\b[A-Za-z]:\\[^\r\n]*/gu;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/giu;
const HTML_TAG_PATTERN = /<[^>]*>/gu;
const NUMERIC_RANGE_OR_COMPENSATION_PATTERN =
  /(?:[$€£¥₹]\s*\d|\b(?:salary|usd|eur|gbp)\b|\d[\d,.\s]*[km]?\s*(?:-|–|—|\bto\b)\s*\d[\d,.\s]*[km]?)/iu;

export function normalizeKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('en-US');
}

export function cleanDisplayString(
  value: unknown,
  maximumLength = 500,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const cleaned = stripControlCharacters(decode(value))
    .replace(HTML_TAG_PATTERN, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

  if (!cleaned || /^(?:none|null|n\/a|undefined)$/iu.test(cleaned)) {
    return null;
  }

  return [...cleaned].slice(0, maximumLength).join('');
}

function stripControlCharacters(value: string): string {
  return [...value]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      return (code >= 0 && code <= 8) ||
        code === 11 ||
        code === 12 ||
        (code >= 14 && code <= 31) ||
        code === 127
        ? ' '
        : character;
    })
    .join('');
}

export function sanitizeProfessionalText(
  value: unknown,
  maximumLength: number,
): string | null {
  const cleaned = cleanDisplayString(value, maximumLength * 2);
  if (!cleaned) {
    return null;
  }

  const safe = cleaned
    .replace(EMAIL_PATTERN, ' ')
    .replace(PHONE_PATTERN, ' ')
    .replace(SOURCE_PATH_PATTERN, ' ')
    .replace(URL_PATTERN, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

  return safe ? [...safe].slice(0, maximumLength).join('') : null;
}

export function canonicalizeLinkedinUrl(value: unknown): string | null {
  const candidate = cleanDisplayString(value, 500);
  if (!candidate) {
    return null;
  }

  const withProtocol = /^https?:\/\//iu.test(candidate)
    ? candidate
    : `https://${candidate}`;

  try {
    const url = new URL(withProtocol);
    const hostname = url.hostname.toLocaleLowerCase('en-US');
    if (!/^(?:(?:[a-z]{2,3}|www)\.)?linkedin\.com$/u.test(hostname)) {
      return null;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length !== 2 || segments[0]?.toLocaleLowerCase() !== 'in') {
      return null;
    }

    const slug = segments[1]?.trim();
    if (!slug || slug.length > 200) {
      return null;
    }

    return `https://www.linkedin.com/in/${encodeURIComponent(
      decodeURIComponent(slug),
    )}`;
  } catch {
    return null;
  }
}

export function parseYearsExperience(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    ? Math.round(parsed * 10) / 10
    : null;
}

export function normalizePartialDate(value: unknown): string | null {
  const cleaned = cleanDisplayString(value, 10);
  if (!cleaned) {
    return null;
  }
  return /^(?:19|20)\d{2}(?:-(?:0[1-9]|1[0-2]))?$/u.test(cleaned)
    ? cleaned
    : null;
}

export function parseYear(value: unknown): number | null {
  const cleaned = cleanDisplayString(value, 10);
  if (!cleaned || !/^(?:19|20)\d{2}$/u.test(cleaned.slice(0, 4))) {
    return null;
  }
  return Number(cleaned.slice(0, 4));
}

export function isNumericRangeOrCompensation(value: string): boolean {
  return NUMERIC_RANGE_OR_COMPENSATION_PATTERN.test(value);
}

export function toCanonicalSkill(value: unknown): {
  name: string;
  normalizedName: string;
} | null {
  const name = cleanDisplayString(value, 100);
  if (
    !name ||
    EMAIL_PATTERN.test(name) ||
    PHONE_PATTERN.test(name) ||
    isNumericRangeOrCompensation(name) ||
    /(?:https?:\/\/|www\.|linkedin\.com)/iu.test(name)
  ) {
    EMAIL_PATTERN.lastIndex = 0;
    PHONE_PATTERN.lastIndex = 0;
    return null;
  }
  EMAIL_PATTERN.lastIndex = 0;
  PHONE_PATTERN.lastIndex = 0;

  const normalizedName = normalizeKey(name);
  return normalizedName ? { name, normalizedName } : null;
}

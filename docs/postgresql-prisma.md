# PostgreSQL and Prisma

Related documents: [`README.md`](README.md), [`backend-nestjs.md`](backend-nestjs.md), [`elasticsearch.md`](elasticsearch.md), and [`pipelines.md`](pipelines.md).

## Role

PostgreSQL is the canonical source of truth for normalized professional profiles. Elasticsearch is rebuilt from PostgreSQL and must never become the only copy of imported data.

Prisma owns:

- The relational schema.
- Reproducible migrations.
- Import transactions.
- Profile, skill, and relationship persistence.
- Cursor-based reads used by the Elasticsearch reindex command.

Prisma does not own Elasticsearch mappings or Query DSL.

## Canonical Model

Conceptual schema:

```text
Profile
  id UUID primary key
  linkedinUrl unique
  linkedinId nullable
  fullName
  jobTitle nullable
  companyName nullable
  industry nullable
  location nullable
  normalizedLocation nullable
  country nullable
  summary nullable
  yearsExperience nullable
  experience JSONB
  education JSONB
  createdAt
  updatedAt

Skill
  id UUID primary key
  name
  normalizedName unique

ProfileSkill
  profileId
  skillId
  primary key (profileId, skillId)
```

Use explicit relation names and database mappings only when they improve clarity. Avoid a generic raw-profile table containing all source columns.

## Persisted Data Policy

Allowed fields:

- Name and LinkedIn URL.
- Current professional role and company.
- Industry.
- Broad location and country.
- Professional summary.
- Skills.
- Sanitized employment history.
- Sanitized education history.
- Years of experience.

Forbidden fields:

- Phone numbers.
- Email addresses.
- Street addresses and postal codes.
- Birth date or year.
- Gender.
- Inferred salary.
- Raw source paths.
- Unfiltered source rows.

Experience and education JSON must be reconstructed from approved fields, not copied wholesale.

Allowed JSON shapes are explicit and closed:

```ts
interface EmploymentRecord {
  jobTitle: string | null;
  companyName: string | null;
  location: string | null;
  startDate: string | null; // YYYY or YYYY-MM only
  endDate: string | null;   // YYYY or YYYY-MM only
  isCurrent: boolean | null; // true=current, false=ended, null=unknown
  description: string | null; // sanitized plain text
}

interface EducationRecord {
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
}
```

The ingestion boundary rejects unknown nested properties before persistence. These objects must never contain contact details, street addresses, birth information, gender, salary, source paths, or the original nested source object.

## Normalization

- Canonicalize LinkedIn URLs before uniqueness checks.
- Normalize skill keys with Unicode normalization, trimming, whitespace collapse, and case folding.
- Preserve a clean display name separately from the normalized skill key.
- Normalize location keys separately from display location.
- Decode HTML entities before persistence.
- Convert textual nulls and empty strings to database null.
- Accept only canonical `https://www.linkedin.com/in/...` profile URLs after removing query strings, fragments, duplicate slashes, and a trailing slash.

`linkedinUrl` is the required stable identity key. A data row without a valid canonical LinkedIn profile URL is rejected with reason code `INVALID_LINKEDIN_URL`; the importer must not manufacture an identity from a name or source-row position. Repeated headers are classified as non-data records, not rejected profiles.

## Import Transaction

The importer should fully parse and validate the small source dataset before beginning the database transaction.

Within one transaction:

1. Upsert canonical profiles by LinkedIn URL.
2. Upsert skills by normalized name.
3. Replace each affected profile's skill relationships.
4. Remove canonical records only when an explicit reset or replace mode is requested.
5. Commit after all writes succeed.

The default mode is idempotent upsert, not destructive replacement.

## Deduplication

Deduplicate before database writes using canonical LinkedIn URL.

When duplicate rows conflict:

- Prefer the profile with the highest professional-field completeness score.
- Fill missing values from less complete duplicates.
- Union normalized skills.
- Keep deterministic ordering and conflict rules.
- Count conflicts without logging raw values.

## Indexes

Required relational indexes:

- Unique `Profile.linkedinUrl`.
- Unique `Skill.normalizedName`.
- Primary composite key on `ProfileSkill`.
- Reverse lookup index on `ProfileSkill.skillId` when not covered by the primary key order.
- Index supporting profile ID cursor pagination for reindexing.

PostgreSQL full-text and trigram indexes are intentionally omitted because Elasticsearch is the search engine.

## Migrations

- Commit every Prisma migration.
- Never use schema push as the reviewer setup path.
- Production and Compose startup use `prisma migrate deploy`.
- Seed and import commands run after migrations complete.
- Migration containers must exit nonzero on failure.
- Local Docker PostgreSQL is published on host port `55432`; Compose services continue to use `postgres:5432`.

## Elasticsearch Projection Reads

The reindex command reads canonical profiles in stable ID order. Use cursor pagination rather than deep offset pagination, even though this dataset is small.

Each page must include skills and only approved experience and education values. The projection mapper then flattens them into the document described in [`elasticsearch.md`](elasticsearch.md).

## Tests

The real integration suite runs against a separately migrated PostgreSQL `integration` schema. It verifies the expected synthetic profiles and skill relationships, repeats the same import without creating duplicates, rebuilds Elasticsearch from the resulting cursor projection, and checks that the HTTP response exposes only approved fields. Unit tests verify deterministic duplicate merging and the professional-field projection.

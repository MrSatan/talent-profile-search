# NestJS Backend

Related documents: [`README.md`](README.md), [`postgresql-prisma.md`](postgresql-prisma.md), [`elasticsearch.md`](elasticsearch.md), and [`pipelines.md`](pipelines.md).

## Responsibilities

The NestJS application owns:

- HTTP API validation and response contracts.
- Canonical data ingestion into PostgreSQL.
- Elasticsearch index rebuilding from PostgreSQL.
- Elasticsearch search Query DSL construction.
- Health and readiness reporting.
- Configuration validation and safe logging.

It does not own profile editing, authentication, or background synchronization.

## Modules

```text
AppModule
  ConfigModule
  DatabaseModule
  ProfilesModule
  IngestionModule
  SearchModule
  HealthModule
```

`ProfilesModule` owns canonical profile persistence. `SearchModule` owns Elasticsearch documents, index lifecycle, Query DSL, and search responses. `IngestionModule` owns raw-file parsing and normalization.

Avoid circular imports and broad shared modules. Export only providers required by another feature.

## Suggested Structure

```text
src/
  main.ts
  app.module.ts
  config/
  database/
    database.module.ts
    prisma.service.ts
  profiles/
    profiles.module.ts
    profiles.repository.ts
    profile.types.ts
  ingestion/
    ingestion.module.ts
    import.command.ts
    csv-reader.ts
    row-mappers.ts
    normalizer.ts
    importer.service.ts
  search/
    search.module.ts
    search.controller.ts
    search.service.ts
    search.repository.ts
    search-query.builder.ts
    profile-document.mapper.ts
    profile-indexer.service.ts
    profile-index.definition.ts
    dto/
  health/
    health.module.ts
    health.controller.ts
```

Combine files when a responsibility is too small to justify separation.

## HTTP API

### Search profiles

```http
GET /api/v1/profiles
  ?q=software engineer
  &skills=typescript
  &skills=postgresql
  &title=senior engineer
  &location=austin
  &page=1
  &pageSize=20
```

Response:

```json
{
  "items": [
    {
      "id": "8a613ccd-4a04-4e4f-9468-21f59780712e",
      "fullName": "Nika Rahimi",
      "jobTitle": "Senior Software Engineer",
      "companyName": "Example Labs",
      "location": "Tehran, Iran",
      "country": "Iran",
      "yearsExperience": 8.5,
      "skills": ["TypeScript", "PostgreSQL"],
      "matchedSkills": ["TypeScript"],
      "matches": [
        { "field": "skills", "excerpt": null },
        { "field": "experience", "excerpt": "Built TypeScript search services." }
      ],
      "summaryExcerpt": "Builds reliable search and data platforms.",
      "linkedinUrl": "https://www.linkedin.com/in/synthetic-nika-rahimi"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1,
    "tookMs": 4
  },
  "facets": {
    "skills": [
      { "value": "typescript", "count": 1, "selected": true }
    ],
    "locations": [
      { "value": "tehran, iran", "count": 1, "selected": false }
    ]
  }
}
```

`items` are `ProfileCardDto` values and contain only the approved fields shown above. `skills` contains every canonical display name, with keyword-matching skills placed first; the UI initially shows 12 and lets the user reveal the rest. `matchedSkills` identifies skills that matched. `matches` is a bounded list derived from Elasticsearch highlights. Hidden professional fields include a sanitized plain-text excerpt of at most 180 characters so the result explains why it matched; raw highlight markup and forbidden personal fields are never returned. `summaryExcerpt` contains at most 240 plain-text characters. Each facet entry is a `FacetBucketDto` with a normalized filter `value`, the contextual result `count`, and whether that value is currently `selected`. Facets are calculated after the keyword and every active filter, so their counts describe the current result set.

### Skill suggestions

```http
GET /api/v1/facets/skills?q=type&limit=20
```

Response:

```json
{
  "items": [
    { "value": "typescript", "count": 18 }
  ]
}
```

Suggestions are normalized skill values ordered by descending profile count and then ascending value. The endpoint never returns profile documents.

### Profile details

```http
GET /api/v1/profiles/:id
```

This PostgreSQL-backed endpoint returns the complete canonical professional profile: current role, company, industry, broad location, country, full professional summary, every skill, sanitized employment history, sanitized education history, years of experience, and LinkedIn URL. It returns `404 PROFILE_NOT_FOUND` when the UUID does not exist. Contact information, street addresses, birth information, gender, salary, source paths, and raw source values are not stored and cannot enter this response.

### Health

```http
GET /health/live
GET /health/ready
```

Liveness reports that the Node process is running. Readiness verifies PostgreSQL, Elasticsearch, and the `profiles-read` alias.

## Validation

Configure one global `ValidationPipe` with transformation, whitelisting, and rejection of unknown properties.

| Parameter | Rule |
| --- | --- |
| `q` | Optional string, trimmed, maximum 100 characters |
| `skills` | Optional string array with a bounded item count and item length |
| `title` | Optional string, trimmed, maximum 100 characters |
| `location` | Optional string, trimmed, maximum 100 characters |
| `page` | Integer, minimum 1 |
| `pageSize` | Integer from 1 through 50 |

Array parameters use repeated query keys, for example `skills=typescript&skills=postgresql`. Comma-separated skill values are not accepted. The frontend URL and API use the same parameter names.

Normalize values in the service boundary. Do not mutate DTOs in the repository.

## Request Flow

```text
Controller
  -> validated query DTO
  -> SearchService normalization
  -> SearchQueryBuilder pure function
  -> SearchRepository Elasticsearch call
  -> explicit response DTO mapping
```

Do not expose raw Elasticsearch hit objects, `_index`, internal sort values, or unapproved `_source` fields.

## Error Contract

Use stable application codes:

```json
{
  "statusCode": 503,
  "code": "SEARCH_UNAVAILABLE",
  "message": "Profile search is temporarily unavailable."
}
```

Expected codes include:

- `VALIDATION_FAILED`
- `SEARCH_UNAVAILABLE`
- `DATABASE_UNAVAILABLE`
- `INTERNAL_ERROR`

Every HTTP error uses the `statusCode`, `code`, and safe `message` fields shown above. Validation errors may additionally contain `details`, an array of `{ "field": string, "message": string }`; it must never echo the rejected input. `IMPORT_FAILED` and `REINDEX_FAILED` are CLI exit conditions and structured log codes, not HTTP response codes.

Do not include raw records, Elasticsearch request bodies, database URLs, or stack traces in production responses.

## Dependency Injection

- Provide one process-wide Prisma service through `DatabaseModule`.
- Provide one process-wide Elasticsearch client through `SearchModule`.
- Use constructor injection.
- Keep the Query DSL builder pure where practical.
- Do not use service-location patterns.
- Do not add generic repository interfaces without a second concrete need.

## Configuration

Validate environment variables at startup:

```text
NODE_ENV
PORT
DATABASE_URL
ELASTICSEARCH_NODE
ELASTICSEARCH_USERNAME
ELASTICSEARCH_PASSWORD
ELASTICSEARCH_INDEX_ALIAS
WEB_ORIGIN
DATASET_PATH
```

Local Compose may disable Elasticsearch security. Hosted environments must use authentication and TLS.

## Security

- Enable Helmet.
- Restrict development CORS to the configured web origin.
- Use same-origin Nginx proxying in Compose.
- Bound request and query sizes.
- Never log profile source documents.
- Never use executable parsing for raw nested fields.
- Return only approved professional fields.

## Testing

Unit tests cover literal parsing, normalization, row mapping, deterministic deduplication, document projection, Query DSL construction, and pre-swap reindex failure safety.

Integration tests use real PostgreSQL and Elasticsearch instances with a dedicated database schema and index prefix. They verify import idempotency, successful reindexing, combined filters, contextual facets, cross-field and typo-tolerant search, strict query validation, special-character handling, and API response whitelisting. Tests use only synthetic profiles.

The implemented end-to-end browser scenario is described in [`pipelines.md`](pipelines.md).

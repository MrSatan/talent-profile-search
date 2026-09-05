# Execution Pipelines

Related documents: [`README.md`](README.md), [`backend-nestjs.md`](backend-nestjs.md), [`frontend-react.md`](frontend-react.md), [`postgresql-prisma.md`](postgresql-prisma.md), and [`elasticsearch.md`](elasticsearch.md).

## Verified Data Findings

The implemented importer dry run reports only aggregate classifications:

```json
{
  "logicalRecords": 350,
  "sourcePrefixesRemoved": 58,
  "repairedRecords": 13,
  "headerRecords": 2,
  "continuationRecords": 12,
  "acceptedRows": 336,
  "uniqueProfiles": 295,
  "duplicateRows": 41,
  "conflicts": 0,
  "rejectedRows": 0
}
```

The reader streams physical lines, removes recognized source-path prefixes, detects record starts across the observed URL positions, and joins embedded-newline continuations before CSV parsing. Thirteen malformed logical records require the bounded relaxed CSV repair path. Nested Python-style arrays and objects are parsed as data only, never executed.

## Ingestion Pipeline

```text
Raw file
  -> streaming CSV logical-record reader
  -> repeated-header detection
  -> explicit row-layout classifier
  -> safe nested-literal parser
  -> canonical professional-field mapper
  -> Unicode, HTML, URL, null, and whitespace normalization
  -> schema validation
  -> deterministic duplicate merge
  -> Prisma transaction
  -> safe import report
```

Rules:

- Parse logical CSV records, not physical lines.
- Use explicit mappers for observed layouts.
- Treat a row as header-aligned only when its detected employment block is at
  the header's `experience` position; otherwise use the structural anchors.
- Reject collection literals and employee-count/year ranges from scalar role
  and company fields, falling back to the structured current employment record.
- Reject currency and numeric-range values from skills and broad locations so
  inferred salary or company-size columns cannot enter search facets.
- Reject unsupported layouts instead of shifting values silently.
- Permit only data literals in nested-field parsing.
- Parse the complete small dataset before opening the write transaction.
- Never include raw values in reports.
- Treat repeated headers as skipped non-data records and count them separately.
- Reject rows without a valid canonical LinkedIn profile URL using reason code `INVALID_LINKEDIN_URL`.
- Use a zero-rejection threshold for data records: finish classification to produce aggregate reason counts, but do not open the database transaction if any logical profile row is rejected.
- Return a nonzero process exit code on any rejected profile row or failed write.

Implemented command:

```bash
pnpm --filter api data:import
```

Supported options are `--dry-run` and `--replace`. The default is a nondestructive idempotent upsert; unknown options fail closed.

## Reindex Pipeline

```text
PostgreSQL canonical profiles
  -> cursor-paginated reader
  -> safe search-document mapper
  -> new versioned Elasticsearch index
  -> Elasticsearch bulk API
  -> refresh
  -> count verification
  -> smoke search
  -> atomic profiles-read alias swap
  -> old-index cleanup
```

Implemented command:

```bash
pnpm --filter api search:reindex
```

The reindex command is idempotent in outcome. It creates a new index on each successful run but keeps only the configured successful history.

## Runtime Search Pipeline

```text
Browser URL state
  -> React query parameters
  -> GET /api/v1/profiles
  -> NestJS ValidationPipe
  -> normalized search request
  -> Elasticsearch Query DSL
  -> profiles-read alias
  -> response DTO
  -> React result states
```

PostgreSQL is not queried to hydrate each result card. The indexed document contains the complete approved card projection.

## Frontend Interaction Pipeline

```text
Draft text input
  -> short debounce
  -> committed URL parameters
  -> TanStack Query key
  -> abortable fetch
  -> loading or updating state
  -> result, empty, or retry state
```

Selections update immediately. Keyword and title changes reset pagination after debounce. A stale request must never replace the result of a newer request.

## Docker Compose Pipeline

Services:

```text
postgres
elasticsearch
migrate
import
reindex
api
web
```

Startup graph:

```text
PostgreSQL healthy -> migrate -> import ----+
                                              -> reindex -> API healthy -> web
Elasticsearch healthy -----------------------+
```

Behavior:

- `postgres` and `elasticsearch` start in parallel.
- `migrate`, `import`, and `reindex` are one-shot services.
- A failed one-shot service blocks dependent services.
- `api` starts only after the first successful index exists.
- `web` serves the React build and proxies `/api` to NestJS.
- PostgreSQL and Elasticsearch use named volumes.
- PostgreSQL publishes host port `55432` to avoid collisions with a native service; containers use port `5432` internally.
- Local Elasticsearch runs as one node with a bounded JVM heap.
- Kibana is not included.
- Docker reuses matching local images and cached layers by default. The portable base images remain pinned instead of depending on unrelated machine-local application images.

Primary reviewer command:

```bash
docker compose up --build
```

Reset command:

```bash
docker compose down --volumes
```

Normal reviewer startup imports the supplied dataset from `data/raw/300 user linkedin.txt`; the `import` one-shot service receives that path through `DATASET_PATH`. If the file is absent, the service exits nonzero with a safe message naming only the expected path, and dependent services do not start.

The raw file may be included only in the private ZIP returned to the employer because it was supplied for this exercise. It must not be committed to or published from a public repository. Automated tests and CI override the container `DATASET_PATH` with `/app/data/fixtures/profiles.synthetic.csv`; normal Compose startup does not silently fall back to synthetic data.

## CI Pipeline

```text
Checkout
  -> pnpm install --frozen-lockfile
  -> formatting check
  -> lint
  -> typecheck
  -> unit tests
  -> start PostgreSQL and Elasticsearch
  -> Prisma migrate deploy
  -> import synthetic fixture
  -> Elasticsearch reindex
  -> API integration tests
  -> frontend component tests
  -> production builds
  -> Playwright search scenario
  -> Docker image build verification
```

The checked-in `.github/workflows/ci.yml` implements this flow. It runs the static gates, builds and starts the full reviewer stack with the synthetic dataset override, migrates an isolated `integration` schema, runs the real API integration suite, installs Chromium, executes the Playwright scenario, and tears down volumes even after failure. Integration Elasticsearch indexes use the `profiles-integration-*` namespace so their cleanup cannot affect the normal `profiles-*` indexes.

CI must never read `300 user linkedin.txt`. Its environment must set `DATASET_PATH` explicitly to `data/fixtures/profiles.synthetic.csv`.

## End-to-End Scenarios

The checked-in Playwright scenario:

1. Open the application.
2. Verify the initial synthetic result count.
3. Search by keyword.
4. Select a skill.
5. Enter a title filter.
6. Verify URL parameters.
7. Verify the expected synthetic profile appears.
8. Clear filters.
9. Verify the initial result set returns.

A second scenario uses a 375 px viewport, dark color scheme, and reduced-motion preference. It verifies that desktop filters collapse into the mobile disclosure, the disclosure meets the primary touch-target size, results remain visible, transitions are effectively disabled, and the document does not overflow horizontally.

## Failure and Recovery

| Failure | Required behavior |
| --- | --- |
| Raw row cannot be classified | Count the rejection, finish validation, abort before the transaction, and exit nonzero |
| PostgreSQL import fails | Roll back and exit nonzero |
| Elasticsearch bulk item fails permanently | Abort rebuild and keep old alias |
| Count verification fails | Do not swap alias |
| Smoke search fails | Do not swap alias |
| Elasticsearch unavailable at runtime | Return `503 SEARCH_UNAVAILABLE` |
| API unavailable in UI | Preserve controls and show retry state |

## Future Mutation Pipeline

If profile editing is later introduced, add a PostgreSQL transactional outbox and an idempotent indexing worker. Do not add that machinery to the current read-only assignment.

# LinkedIn Profile Search

A complete full-stack profile-search exercise built with NestJS, React, PostgreSQL, Prisma, and Elasticsearch. PostgreSQL is the canonical store; Elasticsearch is a disposable search read model for weighted relevance, typo tolerance, exact filters, and facets.

## Quick start

Requirements: Docker Desktop or Docker Engine with Compose, plus at least 2 GB of memory available to Docker.

Keep the supplied dataset at:

```text
data/raw/300 user linkedin.txt
```

Start the complete reviewer stack:

```bash
docker compose up --build
```

Compose waits for dependencies and runs this sequence automatically:

```text
PostgreSQL -> migration -> import -> versioned Elasticsearch reindex
                                            -> API -> web
```

Open:

- Web application: http://localhost:8080
- API readiness: http://localhost:3000/health/ready
- Search API: http://localhost:3000/api/v1/profiles

PostgreSQL is published on host port `55432` to avoid collisions with a native PostgreSQL service on the conventional port. Containers still communicate on `postgres:5432`.


Stop the stack while retaining data:

```bash
docker compose down
```

Reset containers and permanently remove this project's PostgreSQL and Elasticsearch volumes:

```bash
docker compose down --volumes
```

## Local development

Install Node.js 24 and pnpm 11.25.0, then:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter api prisma:generate
```

Copy `.env.example` to `.env`. Start only the backing services and bootstrap the canonical/search data:

```bash
docker compose up -d postgres elasticsearch
pnpm --filter api prisma:migrate:deploy
pnpm --filter api data:import
pnpm --filter api search:reindex
```

Run the applications in separate terminals:

```bash
pnpm --filter api dev
pnpm --filter web dev
```

The Vite development site is at http://localhost:5173 and proxies `/api` to NestJS on port 3000.

Importer options:

```bash
pnpm --filter api data:import -- --dry-run
pnpm --filter api data:import -- --replace
```

The default import is a nondestructive, idempotent upsert. `--replace` is the only mode that removes existing canonical profiles first.

## Verification

Run the repository-wide checks:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

API integration tests use only the synthetic fixture, a dedicated PostgreSQL `integration` schema, and `profiles-integration-*` Elasticsearch indexes. With the backing services running, migrate that schema once and run the suite:

PowerShell:

```powershell
$env:DATABASE_URL='postgresql://profiles:profiles@localhost:55432/profiles?schema=integration'
pnpm --filter api prisma:migrate:deploy
Remove-Item Env:DATABASE_URL
pnpm --filter api test:integration
```

POSIX shell:

```bash
DATABASE_URL='postgresql://profiles:profiles@localhost:55432/profiles?schema=integration' pnpm --filter api prisma:migrate:deploy
pnpm --filter api test:integration
```

The checked-in CI workflow additionally boots Compose with `data/fixtures/profiles.synthetic.csv`, runs the browser scenarios, and verifies both Docker images.

Playwright normally uses its pinned Chromium. To reuse an installed Chromium-compatible browser locally, set `PLAYWRIGHT_EXECUTABLE_PATH` to that executable before running `pnpm --filter web test:e2e`.

## Search behavior

`GET /api/v1/profiles` accepts `q`, repeated `skills`, `title`, `location`, `page`, and `pageSize` parameters.

- Keywords search names, titles, companies, industries, skills, summaries, experience, and education. Names and current titles have the strongest boosts, with a lower-scoring fuzzy fallback.
- Multiple skills use `AND` semantics.
- Title uses analyzed phrase-prefix matching.
- Location uses normalized exact matching.
- Facets reflect the keyword and every active filter.
- Results sort deterministically after `_score` by normalized name and ID.

## Architecture and privacy

```text
Raw dataset
  -> validated NestJS import
  -> PostgreSQL / Prisma (source of truth)
  -> versioned Elasticsearch index
  -> profiles-read alias
  -> NestJS search API
  -> React application
```

PostgreSQL alone could search this small dataset. Elasticsearch is included deliberately to demonstrate explicit indexing, ranking, fuzzy matching, filters, and facets. Because the application is read-only, it rebuilds Elasticsearch from PostgreSQL instead of introducing runtime dual writes, a queue, or an outbox.

Only approved professional fields are persisted, indexed, and returned. Contact details, street addresses, birth information, gender, salary, and source-path text are excluded. Import reports contain aggregate counts only. Automated tests and CI use synthetic fixtures and never read the supplied raw dataset.

## Raw data quality and ingestion

The supplied file is not one clean, homogeneous CSV. It contains Windows source-path prefixes, repeated headers, embedded-newline continuations, several outer row layouts, and malformed quoting. Some rows have the same field count as the header while representing a different layout, so matching columns by position alone would silently put values such as salary or employee ranges into searchable fields.

The importer handles this as a trust boundary:

1. Stream physical lines, remove only recognized source-path envelopes, and assemble complete input chunks.
2. Parse standards-compliant CSV first; use a bounded relaxed repair only for the observed quoting defects.
3. Detect repeated headers and continuation artifacts instead of treating them as profiles.
4. Use header positions only when the row's structured experience block agrees with the header. Otherwise, map the row from stable structural anchors such as the LinkedIn URL, identity fields, and nested experience, education, and skill collections.
5. Parse Python-style nested lists and dictionaries with a data-only parser. The importer never uses `eval`, `new Function`, or executable parsing.
6. Normalize Unicode, HTML entities, whitespace, URLs, partial dates, skills, and locations. Reject collection literals, currency values, and numeric ranges from scalar professional fields and search facets.
7. Validate every mapped profile before persistence, then merge duplicates deterministically by canonical LinkedIn identity.

The import is fail-closed: it classifies the complete dataset and reports aggregate reason counts, but opens no database write transaction if any profile row is rejected. Re-running it is idempotent, and raw values never appear in logs or reports.

The verified dry run found 358 physical lines, assembled them into 338 input chunks, and parsed 350 CSV rows. After separating 2 headers and 12 continuation artifacts, it accepted 336 source profiles and deterministically merged 41 duplicate rows into 295 unique canonical profiles. Thirteen chunks required the bounded quoting repair, and no profile rows were rejected. These counts describe the supplied private dataset; automated tests use synthetic fixtures only.

See [docs/README.md](docs/README.md) for the detailed architecture and operational contracts.

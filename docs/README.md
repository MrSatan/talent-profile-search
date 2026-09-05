# Project Documentation

This directory contains the implementation contract for the LinkedIn profile search assignment.

## Architecture Summary

```text
Raw dataset
  -> NestJS ingestion command
  -> PostgreSQL through Prisma
  -> NestJS reindex command
  -> versioned Elasticsearch index
  -> profiles-read alias
  -> NestJS search API
  -> React application
```

PostgreSQL owns canonical normalized profiles. Elasticsearch owns a safe, denormalized projection optimized for search result cards. The API serves searches directly from Elasticsearch, while Elasticsearch can always be rebuilt from PostgreSQL.

## Architecture Rationale

PostgreSQL alone could serve this dataset of roughly 300 profiles. Elasticsearch is intentionally included to demonstrate weighted multi-field relevance, typo tolerance, exact filters, facets, and explicit index preparation. PostgreSQL remains the canonical store so Elasticsearch is a disposable read model rather than the only copy of the imported profiles.

The application is read-only after import. It therefore uses a simple import-then-reindex pipeline instead of runtime dual writes, a queue, or a transactional outbox. This keeps the additional search capability explicit without introducing synchronization machinery that the assignment does not need.

## Documentation Map

| Document | Scope |
| --- | --- |
| [`backend-nestjs.md`](backend-nestjs.md) | NestJS modules, APIs, validation, errors, and backend tests |
| [`frontend-react.md`](frontend-react.md) | React structure, URL state, requests, UI states, and accessibility |
| [`postgresql-prisma.md`](postgresql-prisma.md) | Canonical schema, migrations, transactions, and data privacy |
| [`elasticsearch.md`](elasticsearch.md) | Search documents, mappings, ranking, filters, facets, and aliases |
| [`pipelines.md`](pipelines.md) | Import, reindex, runtime, Docker Compose, and CI execution flows |

AI contributors must also follow [`../AGENTS.md`](../AGENTS.md).

## Core Decisions

| Decision | Reason |
| --- | --- |
| PostgreSQL as source of truth | Profiles are structured and require canonical normalization and relationships |
| Elasticsearch as search read model | Demonstrates ranking, fuzzy matching, filters, facets, and bulk indexing |
| Import then reindex | The assignment is read-only, so distributed write synchronization is unnecessary |
| Alias-based index rebuild | A failed rebuild cannot destroy the currently searchable index |
| Search cards from Elasticsearch | Avoids a second hydration query and ordering reconciliation |
| Synthetic CI data | Prevents sensitive raw profile data from entering logs and build artifacts |
| Docker Compose | Gives evaluators one reproducible startup path |

## Search Semantics

- Keyword search covers name, current title, company, industry, skills, summary, experience text, and education text.
- Name and current title receive the strongest relevance boosts.
- Different filter categories combine with logical `AND`.
- Multiple selected skills require all selected skills.
- Job title uses analyzed phrase-prefix matching in filter context.
- Location uses normalized exact matching.
- Facet counts are contextual and reflect the keyword plus every active filter.
- An empty keyword supports browsing with filters.
- Results sort by relevance, then normalized full name, then ID.

## Non-Goals

- Authentication and authorization.
- Profile creation or editing.
- Queues, event streaming, or change-data capture.
- PostgreSQL search fallback.
- Kibana.
- Deep pagination.
- Microservices.
- A generic search-provider abstraction.

These can be reasonable production features, but they do not improve the stated assignment criteria.

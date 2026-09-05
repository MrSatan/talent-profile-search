# Elasticsearch

Related documents: [`README.md`](README.md), [`backend-nestjs.md`](backend-nestjs.md), [`postgresql-prisma.md`](postgresql-prisma.md), and [`pipelines.md`](pipelines.md).

## Role

Elasticsearch is a rebuildable read model for:

- Keyword relevance.
- Typo tolerance.
- Exact skill and location filters.
- Job-title matching.
- Facet aggregations.
- Search-result card retrieval.

PostgreSQL remains authoritative. Never index directly from the raw CSV file.

## Index Naming

Use versioned concrete indexes and one stable read alias:

```text
profiles-20260903142500123-a1b2c3d4
profiles-read -> profiles-20260903142500123-a1b2c3d4
```

The API only queries `profiles-read`. Reindexing only writes to a newly created concrete index.

The concrete-index prefix is derived from the alias by removing a trailing `-read`. This keeps normal indexes under `profiles-*` and integration indexes under `profiles-integration-*`; cleanup is restricted to that prefix.

## Search Document

```ts
interface ProfileSearchDocument {
  id: string;
  fullName: string;
  jobTitle: string | null;
  companyName: string | null;
  industry: string | null;
  location: string | null;
  country: string | null;
  summary: string | null;
  skills: string[];
  skillsText: string;
  experienceText: string;
  educationText: string;
  yearsExperience: number | null;
  linkedinUrl: string;
}
```

Use the PostgreSQL profile ID as Elasticsearch `_id`.

## Mapping

| Field | Mapping |
| --- | --- |
| `id` | `keyword` |
| `fullName` | `text` with normalized `keyword` subfield |
| `jobTitle` | `text` with normalized `keyword` subfield |
| `companyName` | `text` with normalized `keyword` subfield |
| `industry` | `text` with normalized `keyword` subfield |
| `location` | `text` with normalized `keyword` subfield |
| `country` | normalized `keyword` |
| `skills` | normalized `keyword` array |
| `skillsText` | `text` |
| `summary` | `text` |
| `experienceText` | `text` |
| `educationText` | `text` |
| `yearsExperience` | `float` |
| `linkedinUrl` | `keyword`, optionally `index: false` |

Set `dynamic` to `strict` so unexpected or sensitive fields fail indexing instead of silently entering the search document.

## Analysis

Define:

- A text analyzer using standard tokenization, lowercase, and ASCII folding.
- A keyword normalizer using lowercase and ASCII folding.

Do not add language-specific stemming until representative relevance tests prove it improves this multilingual dataset.

Use one shard and zero replicas for the local single-node cluster.

## Query Design

Build a flat `bool` query:

```text
bool
  must:
    relevance query, or match_all when q is empty
  filter:
    exact skill clauses
    analyzed title phrase-prefix clause
    exact location clause
```

Use filter context for non-scoring constraints. Each selected skill gets its own exact term filter so multiple skills mean `ALL`.

### Relevance

Implemented boosts:

```text
fullName^6
jobTitle^5
skillsText^4
companyName^3
industry^2
summary
experienceText
educationText
```

Combine:

- A `cross_fields` multi-field query with `operator: AND` for normal term matching across fields.
- A high-boost phrase query on full name and job title.
- A lower-boost `best_fields` query with `fuzziness: AUTO` for typo tolerance.

The same relevance query drives bounded highlights. Search responses use those highlights to promote matching skills, report which approved professional field caused a match, and provide a short sanitized evidence excerpt for hidden professional fields. Raw highlight markup is never returned by the API.

Place these three clauses in one `bool.should` with `minimum_should_match: 1`. This makes the cross-field clause the normal path, rewards exact phrases, and retains a lower-scoring fuzzy fallback. When `q` is empty, use `match_all` and rely on the deterministic secondary sorts.

The term-oriented clause must allow words to match across fields. A query such as `python engineer` should match `engineer` in the job title and `python` in skills.

Do not use user input as raw Query String syntax. Construct typed Query DSL objects.

## Filters

| Filter | Behavior |
| --- | --- |
| Skills | Exact normalized terms, all selected values required |
| Title | `match_phrase_prefix` on `jobTitle` in filter context, no score contribution |
| Location | Exact normalized keyword term |

Different filter categories combine with `AND`.

## Facets

Use terms aggregations on keyword fields:

- `skills`
- `location.raw`
- `industry.raw` if exposed later

Enable accurate total counts with `track_total_hits`. Bound aggregation sizes and skill-suggestion limits.

Facet aggregations run under the same keyword query and all active filters as the result hits. Counts therefore describe the current result set. They do not use self-excluding/disjunctive aggregation semantics. Facet responses use normalized bucket keys so the returned value can be sent back unchanged as a filter.

## Pagination and Sorting

Use `from` and `size` because the dataset is small and API page size is bounded.

Sort by:

1. `_score` descending.
2. `fullName.raw` ascending.
3. `id` ascending.

Do not add `search_after` until deep pagination becomes a real requirement.

## Reindex Safety

The reindex command must:

1. Create a new versioned index with explicit settings and mappings.
2. Read canonical profiles from PostgreSQL.
3. Transform them through the document mapper.
4. Index them with the Elasticsearch bulk API.
5. Abort if any document is permanently dropped.
6. Refresh the new index once.
7. Verify Elasticsearch count equals PostgreSQL count.
8. Run a smoke search.
9. Atomically remove the alias from the old index and add it to the new index.
10. Retain exactly one previous successful index after the swap and delete older concrete indexes.

If any step before the alias swap fails, delete the incomplete index and leave the existing alias unchanged.

## Availability

When Elasticsearch is unavailable, search returns `503 SEARCH_UNAVAILABLE`. Do not silently execute a PostgreSQL fallback with different relevance behavior.

Readiness requires a reachable cluster and searchable `profiles-read` alias. Liveness does not depend on external services.

## Testing

Use a real Elasticsearch container for integration tests. Verify:

- Exact title matches rank above summary-only matches.
- Name and title boosts behave as intended.
- A controlled typo returns the expected profile.
- Multiple skills require every selected skill.
- Filters do not alter relevance scores.
- Empty keyword plus filters works.
- Facet counts are correct.
- Special characters do not break Query DSL.
- A failed rebuild preserves the old alias.
- A successful rebuild swaps the alias and preserves document counts.

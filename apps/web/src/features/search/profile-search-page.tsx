import { FilterIcon } from '../../components/icons';
import { ErrorState } from '../../components/error-state';
import { Pagination } from '../../components/pagination';
import { ActiveFilters } from './active-filters';
import { FilterPanel } from './filter-panel';
import { ProfileList, ProfileListSkeleton } from './profile-list';
import { useProfileSearch } from './queries';
import { SearchToolbar } from './search-toolbar';
import {
  DEFAULT_SEARCH_PARAMS,
  hasActiveSearch,
  type SearchParams,
} from './search-params';
import { useDebouncedText } from './use-debounced-text';
import { useUrlSearchState } from './use-url-search-state';

export function ProfileSearchPage() {
  const [params, update] = useUrlSearchState();
  const query = useProfileSearch(params);
  const keyword = useDebouncedText(params.q, (q) => update({ q, page: 1 }));
  const data = query.data;
  const isInitialLoading = query.isPending && !data;
  const isUpdating = query.isFetching && Boolean(data);
  const clearFilters = () =>
    update({ ...DEFAULT_SEARCH_PARAMS, pageSize: params.pageSize });

  const filterProps = (idPrefix: string) => ({
    idPrefix,
    skills: params.skills,
    title: params.title,
    location: params.location,
    skillFacets: data?.facets.skills ?? [],
    locationFacets: data?.facets.locations ?? [],
    onSkillsChange: (skills: string[]) => update({ skills, page: 1 }),
    onTitleChange: (title: string) => update({ title, page: 1 }),
    onLocationChange: (location: string) => update({ location, page: 1 }),
    onClear: clearFilters,
  });

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <a className="brand" href="/" aria-label="Profile Atlas home">
            <span className="brand__mark" aria-hidden="true">
              PA
            </span>
            <span>
              <strong>Profile Atlas</strong>
              <small>Professional discovery</small>
            </span>
          </a>
          <div className="site-header__intro">
            <h1>Find the expertise behind the profile.</h1>
          </div>
          <SearchToolbar
            value={keyword.draft}
            onChange={keyword.change}
            onSubmit={keyword.commitNow}
            updating={isUpdating}
          />
        </div>
      </header>

      <main className="search-layout" id="main-content">
        <aside className="filter-rail" aria-label="Profile filters">
          <FilterPanel {...filterProps('desktop')} />
        </aside>

        <section className="results" aria-labelledby="results-heading">
          <details className="mobile-filters">
            <summary>
              <FilterIcon className="icon" />
              Filters
              {filterCount(params) > 0 ? (
                <span>{filterCount(params)} active</span>
              ) : null}
            </summary>
            <FilterPanel {...filterProps('mobile')} />
          </details>

          <div className="results__heading">
            <div>
              <p className="eyebrow">Search results</p>
              <h2 id="results-heading" tabIndex={-1}>
                {data
                  ? `${new Intl.NumberFormat().format(data.meta.total)} ${
                      data.meta.total === 1 ? 'profile' : 'profiles'
                    }`
                  : 'Profiles'}
              </h2>
            </div>
            {data ? (
              <p className="results__timing">Found in {data.meta.tookMs} ms</p>
            ) : null}
          </div>
          <p className="visually-hidden" aria-live="polite" aria-atomic="true">
            {data
              ? `${data.meta.total} profiles found. Page ${data.meta.page} of ${Math.max(
                  data.meta.totalPages,
                  1,
                )}.`
              : 'Loading profiles.'}
          </p>

          <ActiveFilters params={params} update={update} />
          {isUpdating ? (
            <div className="updating-bar" aria-hidden="true" />
          ) : null}

          {isInitialLoading ? <ProfileListSkeleton /> : null}
          {query.isError && !data ? (
            <ErrorState onRetry={() => void query.refetch()} />
          ) : null}
          {query.isError && data ? (
            <div className="inline-error" role="alert">
              Results could not be refreshed.{' '}
              <button type="button" onClick={() => void query.refetch()}>
                Try again
              </button>
            </div>
          ) : null}
          {data && data.items.length > 0 ? (
            <ProfileList items={data.items} />
          ) : null}
          {data && data.items.length === 0 ? (
            <section className="state-card">
              <p className="state-card__eyebrow">No matches yet</p>
              <h2>Try a wider search.</h2>
              <p>
                Remove a skill, shorten the job title, or browse every profile.
              </p>
              {hasActiveSearch(params) ? (
                <button
                  className="button button--primary"
                  type="button"
                  onClick={clearFilters}
                >
                  Clear all filters
                </button>
              ) : null}
            </section>
          ) : null}

          {data ? (
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              onChange={(page) => {
                update({ page });
                document
                  .getElementById('results-heading')
                  ?.scrollIntoView?.({ block: 'start' });
              }}
            />
          ) : null}
        </section>
      </main>
      <footer className="site-footer">
        <p>
          Canonical profiles in PostgreSQL. Search relevance in Elasticsearch.
        </p>
      </footer>
    </div>
  );
}

function filterCount(params: SearchParams): number {
  return (
    params.skills.length +
    Number(Boolean(params.title)) +
    Number(Boolean(params.location))
  );
}

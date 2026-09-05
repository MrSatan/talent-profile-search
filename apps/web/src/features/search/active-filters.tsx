import { CloseIcon } from '../../components/icons';
import type { SearchParams } from './search-params';

interface ActiveFilter {
  key: string;
  label: string;
  remove: () => void;
}

export function ActiveFilters({
  params,
  update,
}: {
  params: SearchParams;
  update: (patch: Partial<SearchParams>) => void;
}) {
  const filters: ActiveFilter[] = [
    ...(params.q
      ? [
          {
            key: 'keyword',
            label: `Keyword: ${params.q}`,
            remove: () => update({ q: '', page: 1 }),
          },
        ]
      : []),
    ...params.skills.map((skill) => ({
      key: `skill-${skill}`,
      label: skill,
      remove: () =>
        update({
          skills: params.skills.filter((value) => value !== skill),
          page: 1,
        }),
    })),
    ...(params.title
      ? [
          {
            key: 'title',
            label: `Title: ${params.title}`,
            remove: () => update({ title: '', page: 1 }),
          },
        ]
      : []),
    ...(params.location
      ? [
          {
            key: 'location',
            label: params.location,
            remove: () => update({ location: '', page: 1 }),
          },
        ]
      : []),
  ];
  if (filters.length === 0) return null;

  return (
    <div className="active-filters" aria-label="Active search filters">
      {filters.map((filter) => (
        <span className="active-filter" key={filter.key}>
          <span>{filter.label}</span>
          <button
            type="button"
            aria-label={`Remove ${filter.label} filter`}
            onClick={filter.remove}
          >
            <CloseIcon className="icon" />
          </button>
        </span>
      ))}
    </div>
  );
}

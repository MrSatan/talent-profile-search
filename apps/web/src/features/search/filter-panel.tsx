import type { FacetBucket } from '../../api/contracts';
import { useDebouncedText } from './use-debounced-text';
import { SkillCombobox } from './skill-combobox';

export function FilterPanel({
  idPrefix,
  skills,
  title,
  location,
  skillFacets,
  locationFacets,
  onSkillsChange,
  onTitleChange,
  onLocationChange,
  onClear,
}: {
  idPrefix: string;
  skills: string[];
  title: string;
  location: string;
  skillFacets: FacetBucket[];
  locationFacets: FacetBucket[];
  onSkillsChange: (skills: string[]) => void;
  onTitleChange: (title: string) => void;
  onLocationChange: (location: string) => void;
  onClear: () => void;
}) {
  const titleInput = useDebouncedText(title, onTitleChange);
  const titleId = `${idPrefix}-title`;
  const locationId = `${idPrefix}-location`;
  const activeCount =
    skills.length + Number(Boolean(title)) + Number(Boolean(location));
  const locations = locationFacets.some((facet) => facet.value === location)
    ? locationFacets
    : location
      ? [{ value: location, count: 0, selected: true }, ...locationFacets]
      : locationFacets;
  const quickSkills = skillFacets
    .filter((facet) => !skills.includes(facet.value))
    .slice(0, 6);

  return (
    <div className="filter-panel">
      <div className="filter-panel__heading">
        <div>
          <p className="eyebrow">Refine</p>
          <h2>Filters</h2>
        </div>
        {activeCount > 0 ? (
          <button className="text-button" type="button" onClick={onClear}>
            Clear {activeCount}
          </button>
        ) : null}
      </div>

      <SkillCombobox
        idPrefix={idPrefix}
        selected={skills}
        onChange={onSkillsChange}
      />

      {quickSkills.length > 0 && skills.length < 10 ? (
        <div className="quick-facets">
          <p>Popular in these results</p>
          <div>
            {quickSkills.map((facet) => (
              <button
                type="button"
                key={facet.value}
                onClick={() => onSkillsChange([...skills, facet.value])}
              >
                <span>{facet.value}</span>
                <span>{facet.count}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor={titleId}>Job title</label>
        <input
          id={titleId}
          value={titleInput.draft}
          maxLength={100}
          autoComplete="off"
          placeholder="e.g. Senior engineer"
          onChange={(event) => titleInput.change(event.target.value)}
          onBlur={titleInput.commitNow}
        />
      </div>

      <div className="field">
        <label htmlFor={locationId}>Location</label>
        <select
          id={locationId}
          value={location}
          onChange={(event) => onLocationChange(event.target.value)}
        >
          <option value="">All locations</option>
          {locations.map((facet) => (
            <option value={facet.value} key={facet.value}>
              {facet.value} ({facet.count})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

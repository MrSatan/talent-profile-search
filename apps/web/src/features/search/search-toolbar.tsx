import type { FormEvent } from 'react';
import { SearchIcon } from '../../components/icons';

export function SearchToolbar({
  value,
  onChange,
  onSubmit,
  updating,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  updating: boolean;
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form className="search-toolbar" role="search" onSubmit={submit}>
      <label htmlFor="profile-keyword">Search profiles</label>
      <div className="search-toolbar__control">
        <SearchIcon className="search-toolbar__icon" />
        <input
          id="profile-keyword"
          type="search"
          value={value}
          maxLength={100}
          autoComplete="off"
          placeholder="Try “search engineer” or “Python”"
          onChange={(event) => onChange(event.target.value)}
        />
        <button className="button button--primary" type="submit">
          Search
        </button>
      </div>
      <span className="search-toolbar__status" aria-live="polite">
        {updating ? 'Updating results…' : ''}
      </span>
    </form>
  );
}

import { ArrowIcon } from './icons';

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Search result pages">
      <button
        className="button button--quiet pagination__button pagination__button--previous"
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ArrowIcon className="icon" />
        Previous
      </button>
      <p aria-live="polite">
        Page <strong>{page}</strong> of <strong>{totalPages}</strong>
      </p>
      <button
        className="button button--quiet pagination__button"
        type="button"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
        <ArrowIcon className="icon" />
      </button>
    </nav>
  );
}

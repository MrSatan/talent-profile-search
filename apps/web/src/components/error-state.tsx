export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="state-card state-card--error" role="alert">
      <p className="state-card__eyebrow">Search unavailable</p>
      <h2>We couldn’t load profiles.</h2>
      <p>Your filters are still here. Check the service and try again.</p>
      <button
        className="button button--primary"
        type="button"
        onClick={onRetry}
      >
        Try again
      </button>
    </section>
  );
}

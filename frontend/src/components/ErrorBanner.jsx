function ErrorBanner({ message, onRetry }) {
  if (!message) return null;

  return (
    <div className="error-banner">
      <p>{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export default ErrorBanner;

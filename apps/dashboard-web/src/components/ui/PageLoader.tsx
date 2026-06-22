export default function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite" aria-label="Loading page">
      <div className="page-loader-spinner" aria-hidden="true" />
      <p>Loading module…</p>
    </div>
  );
}

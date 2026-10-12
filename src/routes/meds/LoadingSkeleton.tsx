/** Pulse placeholder for the /meds pages; mirrors the calculator's skeleton. */
export function LoadingSkeleton() {
  return (
    <div role="status" className="mt-8">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-2/3 bg-cream rounded animate-pulse" />
      <div className="mt-6 h-14 w-full bg-cream rounded animate-pulse" />
      <div className="mt-3 h-14 w-full bg-cream rounded animate-pulse" />
    </div>
  );
}

// Placeholder shaped like a typical page: header, a row of numbers, a list.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-10" aria-busy aria-label="Loading">
      <div className="space-y-3">
        <div className="h-9 w-64 max-w-full rounded-xl bg-surface" />
        <div className="h-4 w-80 max-w-full rounded-lg bg-surface" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[104px] rounded-2xl bg-surface" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-5 w-40 rounded-lg bg-surface" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="size-12 rounded-md bg-surface" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-surface" />
              <div className="h-3 w-1/5 rounded bg-surface" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

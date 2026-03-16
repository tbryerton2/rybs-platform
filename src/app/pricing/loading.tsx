export default function Loading() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <div className="mx-auto max-w-6xl px-6 pt-20">
        <div className="rounded-3xl bg-white p-10 shadow-sm ring-1 ring-slate-200">
          <div className="text-sm text-slate-500">Loading pricing...</div>

          <div className="mt-6 space-y-3">
            <div className="h-4 w-1/3 rounded bg-slate-200 animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-slate-200 animate-pulse" />
            <div className="h-32 w-full rounded bg-slate-200 animate-pulse" />
          </div>
        </div>
      </div>
    </main>
  );
}
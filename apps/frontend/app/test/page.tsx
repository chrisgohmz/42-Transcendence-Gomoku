import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-slate-900">Home</h1>

        <div className="mt-6 space-y-3">
          <Link
            href="/login"
            className="block rounded-xl bg-slate-900 px-4 py-3 text-center text-white hover:bg-slate-700"
          >
            Go to Login
          </Link>

          <Link
            href="/dashboard"
            className="block rounded-xl border border-slate-300 px-4 py-3 text-center text-slate-900 hover:bg-slate-50"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
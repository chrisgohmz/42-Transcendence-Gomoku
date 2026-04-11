import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-6 px-4 py-6 text-sm text-slate-600">
        
        <Link
          href="/terms"
          className="hover:text-slate-900"
        >
          Terms of Service
        </Link>

        <Link
          href="/privacy"
          className="hover:text-slate-900"
        >
          Privacy Policy
        </Link>

      </div>
    </footer>
  );
}
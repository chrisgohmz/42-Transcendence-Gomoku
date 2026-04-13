import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-6 text-sm text-slate-600">
        
        {/* Top row: links */}
        <div className="flex gap-6">
          <Link href="/terms" className="hover:text-slate-900">
            Terms of Service
          </Link>
          
          <span className="text-slate-400">|</span>
          
          <Link href="/privacy" className="hover:text-slate-900">
            Privacy Policy
          </Link>
        </div>

        {/* Bottom row: year */}
        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} 五目並べヒーロー
        </p>

      </div>
    </footer>
  );
}
"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProfileBackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="mb-4 inline-flex items-center gap-2 text-sm font-black text-[var(--brass)] no-underline hover:opacity-80"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      Go Back
    </button>
  );
}

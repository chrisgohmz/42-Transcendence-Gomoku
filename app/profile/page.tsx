import { Pencil } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";

import ProfilePicture from "./profile-picture";

export default async function ProfilePage() {
  const sessionData = await getCurrentSession();

  if (!sessionData) {
    redirect("/login");
  }

  const realUser = sessionData.user;

  return (
    <main className="shell">
      <section className="hero mt-4 mb-8 flex w-full flex-col items-center text-center">
        <h1 className="m-0 mb-4 text-5xl font-bold capitalize">
          {realUser.username}&apos;s Profile
        </h1>
        <p className="m-0 text-slate-400">
          Manage your details and view your Gomoku game statistics.
        </p>
      </section>

      <section className="panel">
        <div className="flex w-full flex-row items-stretch gap-8">
          <article className="card flex flex-1 flex-col items-center overflow-hidden text-center">
            <ProfilePicture initialImage={realUser.avatarUrl} />
            <h2 className="m-0 w-full truncate px-4 text-2xl font-bold capitalize">
              {realUser.displayName}
            </h2>
            <p className="meta m-0 mb-2 text-sm text-slate-400">@{realUser.username}</p>
            <div className="inline-links">
              <Link className="text-link flex items-center gap-2" href="/profile/edit">
                <Pencil className="h-4 w-4" />
                Edit Profile
              </Link>
            </div>
          </article>

          <div className="flex flex-2 flex-col gap-8">
            <article className="card flex flex-1 flex-col">
              <h2 className="mb-6 text-2xl font-bold">Your Overall Statistics</h2>
              <div className="flex flex-1 flex-wrap gap-4">
                <div className="flex flex-[1_1_40%] flex-col items-center justify-center rounded-lg bg-[#08101F] py-6 shadow-lg shadow-[#000000]/50">
                  <h2 className="m-0 text-4xl font-bold">0</h2>
                  <p className="meta m-0">Rating</p>
                </div>
                <div className="flex flex-[1_1_40%] flex-col items-center justify-center rounded-lg bg-[#08101F] py-6 shadow-lg shadow-[#000000]/50">
                  <h2 className="m-0 text-4xl font-bold">0%</h2>
                  <p className="meta m-0">Win Rate</p>
                </div>
                <div className="flex flex-[1_1_40%] flex-col items-center justify-center rounded-lg bg-[#08101F] py-6 shadow-lg shadow-[#000000]/50">
                  <h2 className="m-0 text-4xl font-bold">0</h2>
                  <p className="meta m-0">Wins</p>
                </div>
                <div className="flex flex-[1_1_40%] flex-col items-center justify-center rounded-lg bg-[#08101F] py-6 shadow-lg shadow-[#000000]/50">
                  <h2 className="m-0 text-4xl font-bold">0</h2>
                  <p className="meta m-0">Losses</p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}

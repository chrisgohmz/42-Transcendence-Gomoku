import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import { Pencil } from "lucide-react";
import ProfilePicture from "./profile-picture";

export default async function ProfilePage() {
    const sessionData = await getCurrentSession();

    if (!sessionData) {
        redirect("/login");
    }

    const realUser = sessionData.user;

    return (
        <main className="shell">
            <section className="hero flex flex-col items-center text-center w-full mb-8 mt-4">
                <h1 className="text-5xl font-bold capitalize m-0 mb-4">
                    {realUser.username}&apos;s Profile
                </h1>
                <p className="text-slate-400 m-0">Manage your details and view your Gomoku game statistics.</p>
            </section>

            <section className="panel">
                <div className="flex flex-row gap-8 items-stretch w-full">
                    <article className="card flex-1 flex flex-col items-center text-center overflow-hidden">
                        <ProfilePicture initialImage={realUser.avatarUrl} />
                        <h2 className="m-0 text-2xl font-bold capitalize truncate w-full px-4">
                            {realUser.displayName}
                        </h2>
                        <p className="meta m-0 mb-2 text-sm text-slate-400">@{realUser.username}</p>
                        <div className="inline-links">
                            <Link className="text-link flex items-center gap-2" href="/profile/edit">
                                <Pencil className="w-4 h-4" />
                                Edit Profile
                            </Link>
                        </div>
                    </article>

                    <div className="flex-2 flex flex-col gap-8">
                        <article className="card flex-1 flex flex-col">
                            <h2 className="text-2xl font-bold mb-6">Your Overall Statistics</h2>
                            <div className="flex flex-wrap gap-4 flex-1">
                                <div className="shadow-lg shadow-[#000000]/50 bg-[#08101F] rounded-lg flex-[1_1_40%] flex flex-col justify-center items-center py-6">
                                    <h2 className="text-4xl font-bold m-0">0</h2>
                                    <p className="meta m-0">Rating</p>
                                </div>
                                <div className="shadow-lg shadow-[#000000]/50 bg-[#08101F] rounded-lg flex-[1_1_40%] flex flex-col justify-center items-center py-6">
                                    <h2 className="text-4xl font-bold m-0">0%</h2>
                                    <p className="meta m-0">Win Rate</p>
                                </div>
                                <div className="shadow-lg shadow-[#000000]/50 bg-[#08101F] rounded-lg flex-[1_1_40%] flex flex-col justify-center items-center py-6">
                                    <h2 className="text-4xl font-bold m-0">0</h2>
                                    <p className="meta m-0">Wins</p>
                                </div>
                                <div className="shadow-lg shadow-[#000000]/50 bg-[#08101F] rounded-lg flex-[1_1_40%] flex flex-col justify-center items-center py-6">
                                    <h2 className="text-4xl font-bold m-0">0</h2>
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

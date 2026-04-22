import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";

export default async function ProfilePage() {
    const sessionData = await getCurrentSession();
    if (!sessionData) {
        redirect("/login");
    }
    const realUser = sessionData.user;
    return (
        <main className="shell">
            <section className="hero">
                <h1 className="capitalize">{realUser.username}&apos;s Profile</h1>
                <p className="lede">Manage your details and view your Gomoku game statistics.</p>
            </section>
            <section className="panel">
                <div className="flex flex-row gap-8 items-stretch w-full">
                    <article className="card flex-1 flex flex-col items-center text-center">
                        <div className="w-[300px] h-[300px] bg-[#ccc] rounded-full mb-6"></div>
                        <h2 className="m-0 text-2xl font-bold capitalize">{realUser.username}</h2>
                        <p className="meta mb-2">Gomoku Player</p>
                        <div className="inline-links">
                            <Link className="text-link" href="#">Edit Profile</Link>
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
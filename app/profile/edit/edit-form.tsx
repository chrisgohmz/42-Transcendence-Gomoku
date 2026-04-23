"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateProfile } from "./actions";

export default function EditProfileForm({ currentUsername }: { currentUsername: string }) {
    const [username, setUsername] = useState(currentUsername);
    const [error, setError] = useState("");
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const formData = new FormData();
        formData.append("username", username);

        const result = await updateProfile(formData);

        if (result?.error) {
            setError(result.error);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 bg-[#08101F] p-8 rounded-xl border border-slate-700/50 shadow-2xl">
            <div className="flex flex-col gap-2">
                <label htmlFor="username" className="text-sm font-bold text-slate-300">New Username</label>
                <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="px-4 py-3 bg-[#0c1628] border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-[#4ee8c2] transition-colors"
                    required
                />
            </div>

            {error && <p className="text-red-400 text-sm m-0">{error}</p>}

            <div className="flex gap-4 mt-2">
                <Button type="button" onClick={() => router.push("/profile")} className="flex-1 bg-transparent border border-slate-700 text-slate-300 hover:bg-slate-800">
                    Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-[#4ee8c2] text-[#04131a] hover:bg-[#4ee8c2]/90 font-bold">
                    Save Changes
                </Button>
            </div>
        </form>
    );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { saveAccountSettings } from "./actions";

export default function EditProfileForm({ currentUsername, currentDisplayName }: { currentUsername: string, currentDisplayName: string }) {
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");

        const form = e.currentTarget;
        const formData = new FormData(form);
        const result = await saveAccountSettings(formData);

        if (result?.error) {
            setError(result.error);
        } else if (result?.success) {
            setSuccessMessage(result.success);
            (form.elements.namedItem("currentPassword") as HTMLInputElement).value = "";
            (form.elements.namedItem("newPassword") as HTMLInputElement).value = "";
            (form.elements.namedItem("confirmPassword") as HTMLInputElement).value = "";

            setTimeout(() => {
                router.push("/profile");
            }, 1500);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-8 bg-[#08101F] p-8 rounded-xl border border-slate-700/50 shadow-2xl mt-8 text-left w-full">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 w-full">
                {/* Left Column: Profile Section */}
                <div className="flex flex-col gap-6">
                    <h2 className="text-xl font-bold text-white m-0">Profile Details</h2>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="username" className="text-sm font-bold text-slate-300">Username (Not editable)</label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            defaultValue={currentUsername}
                            className="px-4 py-3 bg-[#0c1628] border border-slate-700/50 rounded-xl text-slate-500 cursor-not-allowed"
                            readOnly
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="displayName" className="text-sm font-bold text-slate-300">Display Name</label>
                        <input
                            id="displayName"
                            name="displayName"
                            type="text"
                            defaultValue={currentDisplayName}
                            className="px-4 py-3 bg-[#0c1628] border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-[#4ee8c2] transition-colors"
                            required
                        />
                    </div>
                </div>

                {/* Right Column: Password Section */}
                <div className="flex flex-col gap-6">
                    <h2 className="text-xl font-bold text-white m-0">Change Password</h2>
                    <p className="text-sm text-slate-400 m-0">Leave these blank if you do not want to change your password.</p>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="currentPassword" className="text-sm font-bold text-slate-300">Current Password</label>
                        <input
                            id="currentPassword"
                            name="currentPassword"
                            type="password"
                            className="px-4 py-3 bg-[#0c1628] border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-[#4ee8c2] transition-colors"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="newPassword" className="text-sm font-bold text-slate-300">New Password</label>
                        <input
                            id="newPassword"
                            name="newPassword"
                            type="password"
                            className="px-4 py-3 bg-[#0c1628] border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-[#4ee8c2] transition-colors"
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="confirmPassword" className="text-sm font-bold text-slate-300">Confirm New Password</label>
                        <input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            className="px-4 py-3 bg-[#0c1628] border border-slate-700/50 rounded-xl text-white focus:outline-none focus:border-[#4ee8c2] transition-colors"
                        />
                    </div>
                </div>
            </div>

            {error && <p className="text-red-400 text-sm m-0 text-center">{error}</p>}
            {successMessage && <p className="text-[#4ee8c2] text-sm m-0 text-center">{successMessage}</p>}

            {/* Single Main Button Group */}
            <div className="flex justify-end gap-4 mt-2">
                <Button type="button" variant="outline" className="px-6 border-slate-700/50 text-slate-300 hover:bg-slate-800" onClick={() => router.push("/profile")}>
                    Cancel
                </Button>
                <Button type="submit" className="px-8 bg-[#4ee8c2] text-[#04131a] hover:bg-[#4ee8c2]/90 font-bold">
                    Save Changes
                </Button>
            </div>
        </form>
    );
}

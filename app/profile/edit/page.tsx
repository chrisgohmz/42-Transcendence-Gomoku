import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import EditProfileForm from "./edit-form";

export default async function EditProfilePage() {
    const sessionData = await getCurrentSession();

    if (!sessionData) {
        redirect("/login");
    }

    return (
        <main className="shell">
            <section className="hero flex flex-col items-center text-center w-full mb-8 mt-4">
                <h1 className="text-5xl font-bold m-0 mb-4">Edit Profile</h1>
                <p className="text-slate-400 m-0">Update your screen name and view your account details.</p>
            </section>

            <section className="w-full max-w-4xl mx-auto">
                <EditProfileForm
                    currentUsername={sessionData.user.username}
                    currentDisplayName={sessionData.user.displayName}
                />
            </section>
        </main>
    );
}

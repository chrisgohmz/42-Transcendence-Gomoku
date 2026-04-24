import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import EditProfileForm from "./edit-form";

export default async function EditProfilePage() {
    const sessionData = await getCurrentSession();

    if (!sessionData) {
        redirect("/login");
    }

    return (
        <main className="shell flex flex-col items-start text-left">
            <section className="hero w-full">
                <h1 className="text-5xl font-bold m-0">Edit Profile</h1>
                <p className="lede">Update your screen name and view your account details.</p>
            </section>

            <section className="w-full max-w-md mt-8 mr-auto">
                <EditProfileForm
                    currentUsername={sessionData.user.username}
                    currentDisplayName={sessionData.user.displayName}
                />
            </section>
        </main>
    );
}

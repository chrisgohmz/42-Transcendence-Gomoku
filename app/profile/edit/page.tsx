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
      <section className="hero mt-4 mb-8 flex w-full flex-col items-center text-center">
        <h1 className="m-0 mb-4 text-5xl font-bold">Edit Profile</h1>
        <p className="m-0 text-slate-400">Update your screen name and view your account details.</p>
      </section>

      <section className="mx-auto w-full max-w-4xl">
        <EditProfileForm
          currentUsername={sessionData.user.username}
          currentDisplayName={sessionData.user.displayName}
        />
      </section>
    </main>
  );
}

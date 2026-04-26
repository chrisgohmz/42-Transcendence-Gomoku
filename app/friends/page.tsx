import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth";

import FriendsContent from "./friends-layout";

export default async function FriendsPage() {
  const sessionData = await getCurrentSession();

  if (!sessionData) {
    redirect("/login");
  }

  return <FriendsContent />;
}

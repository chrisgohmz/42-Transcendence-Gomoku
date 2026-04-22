import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";
import MessagesContent from "./messages-layout";

export default async function MessagesPage() {
    const sessionData = await getCurrentSession();

    if (!sessionData) {
        redirect("/login");
    }

    return <MessagesContent />;
}
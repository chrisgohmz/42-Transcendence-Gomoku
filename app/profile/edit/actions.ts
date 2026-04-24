"use server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateProfile(formData: FormData) {
    const sessionData = await getCurrentSession();

    if (!sessionData) {
        return { error: "You must be logged in to do this." };
    }

    const newUsername = formData.get("username") as string;
    const newDisplayName = formData.get("displayName") as string;

    // Basic validation
    if (!newUsername || newUsername.length < 3) {
        return { error: "Username must be at least 3 characters long." };
    }

    if (!newDisplayName || newDisplayName.trim() === "") {
        return { error: "Display name cannot be empty." };
    }

    try {
        await prisma.user.update({
            where: { id: sessionData.user.id },
            data: {
                username: newUsername,
                displayName: newDisplayName
            },
        });
    } catch (error: any) {
        // Handle case where someone else already has that username
        if (error.code === "P2002") {
            return { error: "That username is already taken." };
        }
        return { error: "Something went wrong. Please try again." };
    }

    // This refreshes the page so you see the new name immediately
    revalidatePath("/", "layout");
    redirect("/profile");
}

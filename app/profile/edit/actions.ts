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

    if (!newUsername || newUsername.length < 3) {
        return { error: "Username must be at least 3 characters long." };
    }

    try {
        await prisma.user.update({
            where: { id: sessionData.user.id },
            data: { username: newUsername },
        });
    } catch (error: any) {
        if (error.code === "P2002") {
            return { error: "That username is already taken by someone else." };
        }
        return { error: "Something went wrong. Please try again." };
    }

    revalidatePath("/", "layout");
    redirect("/profile");
}

"use server";

import { getCurrentSession, verifyPassword, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function saveAccountSettings(formData: FormData) {
    const sessionData = await getCurrentSession();

    if (!sessionData) {
        return { error: "You must be logged in to do this." };
    }

    const newDisplayName = formData.get("displayName") as string;
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    // 1. Update Display Name
    if (!newDisplayName || newDisplayName.trim() === "") {
        return { error: "Display name cannot be empty." };
    }

    try {
        await prisma.user.update({
            where: { id: sessionData.user.id },
            data: { displayName: newDisplayName },
        });
    } catch (error) {
        return { error: "Something went wrong saving your profile." };
    }

    // 2. Check if they want to change the password
    const wantsToChangePassword = currentPassword || newPassword || confirmPassword;

    if (wantsToChangePassword) {
        if (!currentPassword || !newPassword || !confirmPassword) {
            return { error: "Please fill in all three password fields to change it." };
        }

        if (newPassword !== confirmPassword) {
            return { error: "New passwords do not match." };
        }

        if (newPassword.length < 8) {
            return { error: "Password must be at least 8 characters long." };
        }

        const user = await prisma.user.findUnique({
            where: { id: sessionData.user.id },
        });

        const isValid = user && (await verifyPassword(currentPassword, user.passwordHash ?? null));

        if (!isValid) {
            return { error: "Current password is incorrect." };
        }

        const newPasswordHash = await hashPassword(newPassword);

        await prisma.user.update({
            where: { id: sessionData.user.id },
            data: { passwordHash: newPasswordHash },
        });
    }

    revalidatePath("/", "layout");
    return { success: "Changes saved successfully!" };
}

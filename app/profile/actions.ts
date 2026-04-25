"use server";

import { getCurrentSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function uploadProfilePicture(formData: FormData) {
    const sessionData = await getCurrentSession();

    if (!sessionData) {
        return { error: "You must be logged in to do this." };
    }

    const file = formData.get("file") as File;

    if (!file || file.size === 0) {
        return { error: "No file was selected." };
    }

    if (!file.type.startsWith("image/")) {
        return { error: "Please select a valid image file." };
    }

    if (file.size > 5 * 1024 * 1024) {
        return { error: "Picture is too large. Please keep it under 5MB." };
    }

    try {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const filename = `${sessionData.user.id}-${Date.now()}${path.extname(file.name)}`;
        const uploadDir = path.join(process.cwd(), "public", "uploads");

        await mkdir(uploadDir, { recursive: true });
        const filepath = path.join(uploadDir, filename);

        await writeFile(filepath, buffer);

        const fileUrl = `/uploads/${filename}`;

        await prisma.user.update({
            where: { id: sessionData.user.id },
            data: { avatarUrl: fileUrl },
        });

        revalidatePath("/");
        return { success: true };

    } catch (error) {
        return { error: "Something went wrong while saving the picture." };
    }
}

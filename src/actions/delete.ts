"use server"

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deletePerson(personId: string) {
    try {
        const session = await auth();
        // Check for ADMIN or ORGANIZER role
        const role = (session?.user as any)?.role;
        if (!session?.user || (role !== 'ADMIN' && role !== 'ORGANIZER')) {
            throw new Error("Unauthorized");
        }

        // 1. Find all photos associated with this person BEFORE deleting faces
        const faces = await prisma.face.findMany({
            where: { personId: personId },
            select: { photoId: true }
        });
        const photoIdsToCheck = Array.from(new Set(faces.map(f => f.photoId)));

        // 2. Delete Faces and Person
        await prisma.face.deleteMany({
            where: { personId: personId }
        });

        await prisma.person.delete({
            where: { id: personId }
        });

        // 3. Garbage Collection: Check if photos are now "empty" (no faces left)
        // If they are empty, delete the photo record itself.
        for (const photoId of photoIdsToCheck) {
            const remainingFaces = await prisma.face.count({
                where: { photoId: photoId }
            });
            if (remainingFaces === 0) {
                await prisma.photo.delete({
                    where: { id: photoId }
                });
            }
        }

        revalidatePath("/organizer");
        return { success: true };
    } catch (e) {
        console.error("Delete Person Error:", e);
        return { success: false, error: "Failed to delete person" };
    }
}


export async function deletePhoto(photoId: string) {
    try {
        const session = await auth();
        const role = (session?.user as any)?.role;
        if (!session?.user || (role !== 'ADMIN' && role !== 'ORGANIZER')) {
            throw new Error("Unauthorized");
        }

        // Delete faces associated with this photo first
        await prisma.face.deleteMany({
            where: { photoId: photoId }
        });

        // Delete the photo
        await prisma.photo.delete({
            where: { id: photoId }
        });

        revalidatePath("/organizer");
        return { success: true };
    } catch (e) {
        console.error("Delete Photo Error:", e);
        return { success: false, error: "Failed to delete photo" };
    }
}

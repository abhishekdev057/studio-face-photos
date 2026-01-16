"use server"

import { prisma } from "@/lib/prisma";

export async function getPersonPhotos(personId: string) {
    try {
        const person = await prisma.person.findUnique({
            where: { id: personId },
            include: {
                faces: {
                    include: {
                        photo: true
                    }
                }
            }
        });

        if (!person) return { success: false, error: "Person not found" };

        // Deduplicate photos
        const uniquePhotosMap = new Map();
        person.faces.forEach(face => {
            if (face.photo && !uniquePhotosMap.has(face.photo.id)) {
                uniquePhotosMap.set(face.photo.id, face.photo);
            }
        });

        return { success: true, photos: Array.from(uniquePhotosMap.values()) };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Error fetching photos" };
    }
}

export async function getAllPhotos() {
    try {
        const photos = await prisma.photo.findMany({
            take: 100, // Limit for now
            orderBy: { createdAt: 'desc' }
        });
        return { success: true, photos };
    } catch (e) {
        console.error(e);
        return { success: false, error: "Error fetching photos" };
    }
}

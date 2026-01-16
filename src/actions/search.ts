'use server';

import { prisma } from "@/lib/prisma";
import { euclideanDistance } from "@/utils/math";

import { auth } from "@/auth";

export async function searchPhotos(descriptor: number[]) {
    try {
        const session = await auth();
        if (!session?.user) throw new Error("Unauthorized");

        const vectorString = `[${descriptor.join(",")}]`;


        // Find distinct photos containing a face close to the descriptor
        const photos = await prisma.$queryRaw<any[]>`
       SELECT DISTINCT p.id, p.url, (f.embedding <-> ${vectorString}::vector) as distance
       FROM "Photo" p
       JOIN "Face" f ON f."photoId" = p.id
       WHERE (f.embedding <-> ${vectorString}::vector) < 0.5

       ORDER BY distance ASC
       LIMIT 50
     `;


        // Deduplicate photos (one photo might have multiple matching faces)
        // Since the query orders by distance ASC, the first occurrence is the best match.
        const uniquePhotos = [];
        const seenIds = new Set();
        for (const p of photos) {
            if (!seenIds.has(p.id)) {
                uniquePhotos.push(p);
                seenIds.add(p.id);
            }
        }

        return { success: true, photos: uniquePhotos };

    } catch (e) {
        console.error("Search failed", e);
        return { success: false, error: "Search failed" };
    }
}

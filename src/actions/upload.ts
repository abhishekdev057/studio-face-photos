"use server"

import { auth } from "@/auth";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export async function uploadPhoto(formData: FormData) {
    try {
        const session = await auth();
        if (!session?.user) throw new Error("Unauthorized");

        const file = formData.get("file") as File;
        const descriptorsStr = formData.get("descriptors") as string;

        if (!file) throw new Error("No file");

        // Convert file to base64
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

        // Calculate Hash
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');

        // Create Event if not exists for this user
        const event = await prisma.event.findFirst({
            where: { ownerId: session.user.id }
        });
        let currentEventId = event?.id;

        if (!currentEventId) {
            const newEvent = await prisma.event.create({
                data: {
                    name: "Wedding Event",
                    ownerId: session.user.id!,

                }
            });
            currentEventId = newEvent.id;
        }

        // Check for duplicates
        const existingPhoto = await prisma.photo.findFirst({
            where: {
                eventId: currentEventId,
                hash: hash
            }
        });

        if (existingPhoto) {
            console.log(`Duplicate photo detected (${hash}). Skipping.`);
            return { success: false, duplicate: true };
        }

        // Save Photo
        // Note: Storing base64 in DB is not ideal for production.
        const photo = await prisma.photo.create({
            data: {
                url: base64,
                width: 0,
                height: 0,
                eventId: currentEventId,
                hash: hash
            }
        });

        // Save Faces
        if (descriptorsStr) {
            const descriptors = JSON.parse(descriptorsStr);
            for (const desc of descriptors) {
                const vectorArray = Object.values(desc);
                const vectorString = `[${vectorArray.join(",")}]`;
                const faceId = crypto.randomUUID();

                let personId: string | null = null;

                try {
                    // Find closest match using pgvector operator
                    const matches = await prisma.$queryRaw<any[]>`
                    SELECT "personId", "embedding" <-> ${vectorString}::vector as distance 
                    FROM "Face"
                    WHERE "personId" IS NOT NULL
                    ORDER BY distance ASC
                    LIMIT 1
                  `;

                    // face-api.js recommends Euclidean distance of 0.6. We use 0.5 to be safer (fewer false positives).
                    if (matches.length > 0 && matches[0].distance < 0.5) {

                        personId = matches[0].personId;
                    } else {
                        // Create new person
                        const newPerson = await prisma.person.create({
                            data: { eventId: currentEventId }
                        });
                        personId = newPerson.id;
                    }
                } catch (e) {
                    console.error("Vector search failed (likely locally), creating new person fallback", e);
                    const newPerson = await prisma.person.create({
                        data: { eventId: currentEventId }
                    });
                    personId = newPerson.id;
                }

                await prisma.$executeRawUnsafe(
                    `INSERT INTO "Face" ("id", "photoId", "embedding", "personId") VALUES ($1, $2, $3::vector, $4)`,
                    faceId,
                    photo.id,
                    vectorString,
                    personId
                );

            }
        }

        revalidatePath("/organizer");
        return { success: true };
    } catch (error) {
        console.error("Upload error:", error);
        return { success: false, error: "Failed to upload" };
    }
}


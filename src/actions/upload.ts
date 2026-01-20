"use server"

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadPhoto(formData: FormData) {
    try {
        const session = await auth();
        if (!session?.user) throw new Error("Unauthorized");

        const file = formData.get("file") as File;
        const descriptorsStr = formData.get("descriptors") as string;

        if (!file) throw new Error("No file");

        // Convert file to base64 for Cloudinary upload and Hashing
        const buffer = Buffer.from(await file.arrayBuffer());
        const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;

        // Calculate Hash
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');

        // Create Event if not exists
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

        // Check for duplicates in DB
        const existingPhoto = await prisma.photo.findFirst({
            where: {
                eventId: currentEventId,
                hash: hash
            }
        });

        if (existingPhoto) {
            console.log(`Duplicate photo detected (${hash}). Skipping.`);
            return { success: true, skipped: true };
        }

        // Upload to Cloudinary
        const uploadResult = await new Promise<any>((resolve, reject) => {
            cloudinary.uploader.upload(base64, {
                folder: "wedding_event",
                resource_type: "auto"
            }, (error, result) => {
                if (error) reject(error);
                else resolve(result);
            });
        });

        const cloudUrl = uploadResult.secure_url;
        const width = uploadResult.width;
        const height = uploadResult.height;

        // Save Photo Reference to DB
        const photo = await prisma.photo.create({
            data: {
                url: cloudUrl,
                width: width,
                height: height,
                eventId: currentEventId,
                hash: hash
            }
        });

        // Save Faces (Vectors)
        if (descriptorsStr) {
            const descriptors = JSON.parse(descriptorsStr);
            for (const desc of descriptors) {
                const vectorArray = Object.values(desc);
                const vectorString = `[${vectorArray.join(",")}]`;
                const faceId = crypto.randomUUID();
                let personId: string | null = null;

                try {
                    // Vector Search
                    const matches = await prisma.$queryRaw<any[]>`
                    SELECT "personId", "embedding" <-> ${vectorString}::vector as distance 
                    FROM "Face"
                    WHERE "personId" IS NOT NULL
                    ORDER BY distance ASC
                    LIMIT 1
                  `;

                    if (matches.length > 0 && matches[0].distance < 0.45) {
                        personId = matches[0].personId;
                    } else {
                        const newPerson = await prisma.person.create({
                            data: { eventId: currentEventId }
                        });
                        personId = newPerson.id;
                    }
                } catch (e) {
                    console.error("Vector search failed, fallback new person", e);
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


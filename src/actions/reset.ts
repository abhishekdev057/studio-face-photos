"use server"

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function resetEventData() {
    try {
        const session = await auth();
        const role = (session?.user as any)?.role;
        if (!session?.user || (role !== 'ADMIN' && role !== 'ORGANIZER')) {
            throw new Error("Unauthorized");
        }

        const userId = session.user.id;

        // Find user's event
        const event = await prisma.event.findFirst({
            where: { ownerId: userId }
        });

        if (event) {
            // Delete all faces first
            // We need to find faces linked to this event's photos or people
            // Simpler to just delete all faces for people in this event
            await prisma.face.deleteMany({
                where: {
                    person: {
                        eventId: event.id
                    }
                }
            });

            // Delete all photos in this event
            await prisma.photo.deleteMany({
                where: { eventId: event.id }
            });

            // Delete all people in this event
            await prisma.person.deleteMany({
                where: { eventId: event.id }
            });
        }

        revalidatePath("/organizer");
        return { success: true };
    } catch (e) {
        console.error("Reset Error:", e);
        return { success: false, error: "Failed to reset data" };
    }
}

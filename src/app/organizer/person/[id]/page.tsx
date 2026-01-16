import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PersonDetailClient from "@/components/PersonDetailClient";

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PersonPage({ params }: PageProps) {
    const { id } = await params;

    const person = await prisma.person.findUnique({
        where: { id },
        include: {
            faces: {
                include: {
                    photo: true
                }
            }
        }
    });

    if (!person) {
        notFound();
    }

    // Extract unique photos from faces (deduplicate if person appears multiple times in one photo)
    const uniquePhotosMap = new Map();
    person.faces.forEach(face => {
        if (face.photo && !uniquePhotosMap.has(face.photo.id)) {
            uniquePhotosMap.set(face.photo.id, face.photo);
        }
    });
    const photos = Array.from(uniquePhotosMap.values());


    return <PersonDetailClient person={person} initialPhotos={photos} />;
}

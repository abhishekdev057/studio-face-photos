import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import {
  chooseBestPersonMatch,
  FACE_EXTENDED_MATCH_THRESHOLD,
  FACE_UPLOAD_CANDIDATE_LIMIT,
  normalizeDescriptor,
  type FaceCandidateRow,
} from "@/lib/faceMatching";

export function parseDescriptorPayload(rawValue: unknown) {
  const parsed =
    typeof rawValue === "string" && rawValue.trim().length > 0 ? JSON.parse(rawValue) : rawValue;

  if (!Array.isArray(parsed)) {
    return [] as number[][];
  }

  return parsed
    .map((descriptor) => {
      if (Array.isArray(descriptor)) {
        return normalizeDescriptor(descriptor);
      }

      if (descriptor && typeof descriptor === "object") {
        return normalizeDescriptor(Object.values(descriptor).map((value) => Number(value)));
      }

      return null;
    })
    .filter((descriptor): descriptor is number[] => Array.isArray(descriptor));
}

export async function indexPhotoDescriptors({
  tx,
  eventId,
  photoId,
  descriptors,
}: {
  tx: Prisma.TransactionClient;
  eventId: string;
  photoId: string;
  descriptors: number[][];
}) {
  const assigned = new Set<string>();

  for (const descriptor of descriptors) {
    const vectorString = `[${descriptor.join(",")}]`;
    const faceId = crypto.randomUUID();
    let personId: string | null = null;

    try {
      const matches = await tx.$queryRaw<FaceCandidateRow[]>`
        SELECT f."personId", f."photoId", (f.embedding <-> ${vectorString}::vector) AS distance
        FROM "Face" f
        INNER JOIN "Person" person ON person.id = f."personId"
        WHERE person."eventId" = ${eventId}
          AND (f.embedding <-> ${vectorString}::vector) < ${FACE_EXTENDED_MATCH_THRESHOLD}
        ORDER BY distance ASC
        LIMIT ${FACE_UPLOAD_CANDIDATE_LIMIT}
      `;

      const bestMatch = chooseBestPersonMatch(matches, assigned);
      if (bestMatch) {
        personId = bestMatch.personId;
      } else {
        const newPerson = await tx.person.create({
          data: {
            eventId,
            coverPhotoId: photoId,
          },
        });
        personId = newPerson.id;
      }
    } catch (error) {
      console.error("Vector search failed, creating a new person instead.", error);
      const newPerson = await tx.person.create({
        data: {
          eventId,
          coverPhotoId: photoId,
        },
      });
      personId = newPerson.id;
    }

    if (personId) {
      assigned.add(personId);
      await tx.person.updateMany({
        where: {
          id: personId,
          coverPhotoId: null,
        },
        data: {
          coverPhotoId: photoId,
        },
      });
    }

    await tx.$executeRawUnsafe(
      `INSERT INTO "Face" ("id", "photoId", "embedding", "personId") VALUES ($1, $2, $3::vector, $4)`,
      faceId,
      photoId,
      vectorString,
      personId,
    );
  }

  return Array.from(assigned);
}

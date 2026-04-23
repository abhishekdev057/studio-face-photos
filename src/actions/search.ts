"use server";

import { prisma } from "@/lib/prisma";
import {
  chooseBestPersonMatch,
  FACE_EXTENDED_MATCH_THRESHOLD,
  FACE_SEARCH_CANDIDATE_LIMIT,
  normalizeDescriptor,
  type FaceCandidateRow,
} from "@/lib/faceMatching";
type SearchCandidateRow = FaceCandidateRow;

type PersonPhotoRow = {
  id: string;
  url: string;
  distance: number;
  faceCount: number;
};

export async function searchPhotos(
  workspaceSlug: string,
  descriptor: number[],
) {
  try {
    const normalizedDescriptor = normalizeDescriptor(descriptor);
    if (!normalizedDescriptor) {
      throw new Error("Invalid face descriptor");
    }

    const publicLink = await prisma.shareLink.findUnique({
      where: { slug: workspaceSlug },
      select: { eventId: true },
    });

    if (!publicLink) {
      throw new Error("Public link not found");
    }

    const vectorString = `[${normalizedDescriptor.join(",")}]`;
    const candidates = await prisma.$queryRaw<SearchCandidateRow[]>`
      SELECT f."personId", f."photoId", (f.embedding <-> ${vectorString}::vector) AS distance
      FROM "Photo" p
      JOIN "Face" f ON f."photoId" = p.id
      WHERE p."eventId" = ${publicLink.eventId}
        AND f."personId" IS NOT NULL
        AND (f.embedding <-> ${vectorString}::vector) < ${FACE_EXTENDED_MATCH_THRESHOLD}
      ORDER BY distance ASC
      LIMIT ${FACE_SEARCH_CANDIDATE_LIMIT}
    `;

    const bestMatch = chooseBestPersonMatch(candidates);
    if (!bestMatch) {
      return { success: true, photos: [], provider: "opencv-sface-local" };
    }

    const photos = await prisma.$queryRaw<PersonPhotoRow[]>`
      SELECT p.id, p.url, p."faceCount", MIN(f.embedding <-> ${vectorString}::vector) AS distance
      FROM "Photo" p
      JOIN "Face" f ON f."photoId" = p.id
      WHERE p."eventId" = ${publicLink.eventId}
        AND f."personId" = ${bestMatch.personId}
      GROUP BY p.id, p.url, p."faceCount", p."createdAt"
      ORDER BY distance ASC, p."createdAt" DESC
      LIMIT 240
    `;

    return {
      success: true,
      photos: photos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        faceCount: photo.faceCount,
      })),
      provider: "opencv-sface-local",
    };
  } catch (error) {
    console.error("Search failed", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
}

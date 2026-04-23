"use server";

import { prisma } from "@/lib/prisma";
import {
  choosePublicPersonMatch,
  FACE_PUBLIC_CANDIDATE_THRESHOLD,
  FACE_SEARCH_CANDIDATE_LIMIT,
  getPublicPhotoDistanceCutoff,
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
        AND (f.embedding <-> ${vectorString}::vector) < ${FACE_PUBLIC_CANDIDATE_THRESHOLD}
      ORDER BY distance ASC
      LIMIT ${FACE_SEARCH_CANDIDATE_LIMIT}
    `;

    const decision = choosePublicPersonMatch(candidates);
    if (!decision.match) {
      return {
        success: true,
        photos: [],
        provider: "opencv-sface-local",
        confidence: "none",
        reason: decision.reason,
        message:
          decision.reason === "ambiguous"
            ? "More than one close match was found, so nothing was shown."
            : "No verified match was found in this workspace.",
      };
    }

    const photoDistanceCutoff = getPublicPhotoDistanceCutoff(decision.match);
    const photos = await prisma.$queryRaw<PersonPhotoRow[]>`
      SELECT p.id, p.url, p."faceCount", MIN(f.embedding <-> ${vectorString}::vector) AS distance
      FROM "Photo" p
      JOIN "Face" f ON f."photoId" = p.id
      WHERE p."eventId" = ${publicLink.eventId}
        AND f."personId" = ${decision.match.personId}
      GROUP BY p.id, p.url, p."faceCount", p."createdAt"
      ORDER BY distance ASC, p."createdAt" DESC
      LIMIT 240
    `;

    const safePhotos = photos.filter((photo) => photo.distance <= photoDistanceCutoff);

    return {
      success: true,
      photos: safePhotos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        faceCount: photo.faceCount,
      })),
      provider: "opencv-sface-local",
      confidence: decision.confidence,
      reason: safePhotos.length > 0 ? undefined : "low-support",
      message:
        safePhotos.length > 0
          ? "Verified match only"
          : "A close match was found, but not enough photos passed the verification check.",
    };
  } catch (error) {
    console.error("Search failed", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
}

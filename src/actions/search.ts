"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  choosePublicPersonMatch,
  expandPublicMatchedPeople,
  FACE_PUBLIC_CANDIDATE_THRESHOLD,
  FACE_SEARCH_CANDIDATE_LIMIT,
  normalizeDescriptor,
  type FaceCandidateRow,
} from "@/lib/faceMatching";
type SearchCandidateRow = FaceCandidateRow;

type PersonPhotoRow = {
  id: string;
  url: string;
  personId: string;
  distance: number;
  faceCount: number;
  createdAt: Date;
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

    const relatedPeople = expandPublicMatchedPeople(decision);
    const relatedPersonIds = relatedPeople.map((summary) => summary.personId);

    const photos = await prisma.$queryRaw<PersonPhotoRow[]>`
      SELECT p.id, p.url, p."faceCount", f."personId", MIN(f.embedding <-> ${vectorString}::vector) AS distance, p."createdAt"
      FROM "Photo" p
      JOIN "Face" f ON f."photoId" = p.id
      WHERE p."eventId" = ${publicLink.eventId}
        AND f."personId" IN (${Prisma.join(relatedPersonIds)})
      GROUP BY p.id, p.url, p."faceCount", f."personId", p."createdAt"
      ORDER BY distance ASC, p."createdAt" DESC
      LIMIT 360
    `;

    const safePhotos = new Map<string, PersonPhotoRow>();
    for (const photo of photos) {
      const current = safePhotos.get(photo.id);
      if (!current || photo.distance < current.distance) {
        safePhotos.set(photo.id, photo);
      }
    }

    const orderedSafePhotos = Array.from(safePhotos.values()).sort(
      (left, right) => left.distance - right.distance || right.createdAt.getTime() - left.createdAt.getTime(),
    );

    return {
      success: true,
      photos: orderedSafePhotos.map((photo) => ({
        id: photo.id,
        url: photo.url,
        faceCount: photo.faceCount,
      })),
      provider: "opencv-sface-local",
      confidence: decision.confidence,
      reason: orderedSafePhotos.length > 0 ? undefined : "low-support",
      message:
        orderedSafePhotos.length > 0
          ? relatedPeople.length > 1
            ? "All linked photos from verified related clusters"
            : "All linked photos from the verified match"
          : "A close match was found, but no linked photos were available.",
    };
  } catch (error) {
    console.error("Search failed", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Search failed",
    };
  }
}

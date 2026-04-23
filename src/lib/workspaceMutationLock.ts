import type { Prisma } from "@prisma/client";

const WORKSPACE_FACE_INDEX_LOCK = "aura-face-index";

export async function acquireWorkspaceFaceIndexLock(
  tx: Prisma.TransactionClient,
  workspaceId: string,
) {
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(hashtext(${WORKSPACE_FACE_INDEX_LOCK}), hashtext(${workspaceId}))
  `;
}

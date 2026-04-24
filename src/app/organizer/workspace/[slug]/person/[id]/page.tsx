import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageWorkspace, getWorkspaceForUserBySlug } from "@/lib/workspaces";
import PersonDetailClient from "@/components/PersonDetailClient";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function WorkspacePersonPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  if (session.user.role === "VIEWER") {
    redirect("/guest");
  }

  const { slug, id } = await params;
  const workspace = await getWorkspaceForUserBySlug({
    slug,
    userId: session.user.id,
    globalRole: session.user.role,
  });
  if (!workspace) {
    notFound();
  }

  const person = await prisma.person.findFirst({
    where: {
      id,
      eventId: workspace.id,
    },
    include: {
      faces: {
        include: {
          photo: {
            select: {
              id: true,
              url: true,
              faceCount: true,
            },
          },
        },
      },
      _count: {
        select: { faces: true },
      },
    },
  });

  if (!person) {
    notFound();
  }

  const currentMembershipRole =
    workspace.members.find((member) => member.user.id === session.user.id)?.role ?? null;
  const canManagePerson = canManageWorkspace({
    globalRole: session.user.role,
    ownerId: workspace.ownerId,
    userId: session.user.id,
    membershipRole: currentMembershipRole,
  });

  const uniquePhotosMap = new Map<string, { id: string; url: string; faceCount: number }>();
  for (const face of person.faces) {
    if (face.photo && !uniquePhotosMap.has(face.photo.id)) {
      uniquePhotosMap.set(face.photo.id, face.photo);
    }
  }

  return (
    <PersonDetailClient
      workspaceId={workspace.id}
      workspaceSlug={workspace.slug}
      workspaceName={workspace.name}
      person={{
        id: person.id,
        name: person.name,
        faceCount: person._count.faces,
      }}
      canManage={canManagePerson}
      initialPhotos={Array.from(uniquePhotosMap.values())}
    />
  );
}

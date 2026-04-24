import { redirect } from "next/navigation";
import { getOrganizerPersonPath } from "@/lib/workspaces";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ workspace?: string | string[] }>;
}

export default async function LegacyPersonPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;
  const workspaceSlug =
    typeof query.workspace === "string" && query.workspace.length > 0 ? query.workspace : null;

  if (!workspaceSlug) {
    redirect("/organizer");
  }

  redirect(getOrganizerPersonPath(workspaceSlug, id));
}

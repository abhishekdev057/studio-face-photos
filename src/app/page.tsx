import { auth } from "@/auth";
import { isOrganizer } from "@/lib/workspaces";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  redirect(isOrganizer(session.user.role) ? "/organizer" : "/guest");
}

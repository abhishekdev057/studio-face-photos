import { auth } from "@/auth";
import { doLogout } from "@/actions/logout-action";
import { isOrganizer } from "@/lib/workspaces";
import Link from "next/link";
import { LogOut, LayoutPanelTop } from "lucide-react";

export default async function Navbar() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return null;
  }

  const dashboardHref = isOrganizer(user.role) ? "/organizer" : "/guest";
  const dashboardLabel = isOrganizer(user.role) ? "Organizer" : "Guest";
  const roleLabel =
    user.role === "ADMIN" ? "System admin" : user.role === "ORGANIZER" ? "Organizer" : "Public";

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-2xl">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-4 md:px-6">
        <Link href={dashboardHref} className="flex items-center gap-3 text-slate-950 transition hover:opacity-90">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.25)]">
            <LayoutPanelTop className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-300">Aura</div>
            <div className="text-sm font-semibold">Face Workspace</div>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href={dashboardHref}
            className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 md:inline-flex"
          >
            {dashboardLabel}
          </Link>

          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-950">{user.name || "Workspace User"}</div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
            <div className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 lg:block">
              {roleLabel}
            </div>

            <form action={doLogout}>
              <button
                type="submit"
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
                title="Sign Out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
}

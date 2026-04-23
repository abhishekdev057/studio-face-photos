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
    <nav className="sticky top-0 z-50 border-b border-white/70 bg-white/78 backdrop-blur-2xl">
      <div className="page-shell flex h-[4.85rem] items-center justify-between">
        <Link
          href={dashboardHref}
          className="group flex items-center gap-3 text-slate-950 transition hover:opacity-95"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-sky-300 via-cyan-300 to-blue-500 text-slate-950 shadow-[0_14px_35px_rgba(54,182,255,0.28)] transition group-hover:scale-[1.02]">
            <LayoutPanelTop className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-sky-500">Aura</div>
            <div className="text-sm font-semibold tracking-tight">Private Face Workspace</div>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href={dashboardHref}
            className="hidden rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 md:inline-flex"
          >
            {dashboardLabel}
          </Link>

          <div className="flex items-center gap-3 border-l border-slate-200/80 pl-4">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-slate-950">{user.name || "Workspace User"}</div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
            <div className="hidden rounded-full bg-slate-100/90 px-3 py-1 text-xs font-medium text-slate-600 lg:block">
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

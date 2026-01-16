import { auth } from "@/auth";
import { doLogout } from "@/actions/logout-action";
import Link from "next/link";
import { LogOut, Shield } from "lucide-react";

export default async function Navbar() {
    const session = await auth();
    const user = session?.user;
    const role = (user as any)?.role;

    if (!user) return null; // Don't show navbar on login page (usually handled by layout, but basic check here)

    return (
        <nav className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="font-bold text-2xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 transition-all">
                    Aura
                </Link>

                <div className="flex items-center gap-4">
                    {/* Admin/Organizer Link */}
                    {(role === "ADMIN" || role === "ORGANIZER") && (
                        <Link
                            href="/organizer"
                            className="flex items-center gap-2 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition"
                        >
                            <Shield className="w-4 h-4" />
                            Organizer Dashboard
                        </Link>
                    )}

                    <div className="flex items-center gap-3 pl-4 border-l border-zinc-800">
                        <div className="text-right hidden sm:block">
                            <div className="text-sm font-medium text-white">{user.name || "User"}</div>
                            <div className="text-xs text-zinc-500">{user.email}</div>
                        </div>

                        <form action={doLogout}>
                            <button
                                type="submit"
                                className="p-2 text-zinc-400 hover:text-white transition rounded-full hover:bg-zinc-800"
                                title="Sign Out"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </nav>
    );
}

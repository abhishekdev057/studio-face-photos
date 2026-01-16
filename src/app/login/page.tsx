import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Camera } from "lucide-react";

export default async function LoginPage() {
    const session = await auth();
    if (session?.user) {
        if ((session.user as any).role === "ADMIN" || (session.user as any).role === "ORGANIZER") {
            redirect("/organizer");
        } else {
            redirect("/guest");
        }
    }

    return (
        <div className="flex min-h-[calc(100vh-64px)] items-center justify-center p-4 relative overflow-hidden">

            {/* Decorative Background Elements */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px] animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />

            <div className="w-full max-w-md animate-enter z-10">
                <div className="glass-panel rounded-2xl p-8 space-y-8 backdrop-blur-2xl">

                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 mb-4 shadow-lg shadow-cyan-500/20">
                            <Camera className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Welcome Back</h1>
                        <p className="text-zinc-400">Sign in to manage your event photos</p>
                    </div>

                    <form
                        action={async () => {
                            "use server";
                            await signIn("google", { redirectTo: "/organizer" });
                        }}
                        className="space-y-4"
                    >
                        <button
                            type="submit"
                            className="w-full group relative flex items-center justify-center gap-3 bg-white text-black font-semibold py-4 px-6 rounded-xl hover:scale-[1.02] transition-all duration-300 shadow-xl shadow-white/5 overflow-hidden"
                        >
                            <img
                                src="https://authjs.dev/img/providers/google.svg"
                                alt="Google"
                                className="w-5 h-5 relative z-10"
                            />
                            <span className="relative z-10">Continue with Google</span>

                            <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>

                        <div className="text-center text-xs text-zinc-500">
                            By signing in, I agree to allow face analysis on my photos.
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import GoogleLoginForm from "@/components/GoogleLoginForm"; // We will create this

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
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 p-8 rounded-xl shadow-2xl space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
                    <p className="text-zinc-500">
                        Sign in to access your wedding photos
                    </p>
                </div>

                <GoogleLoginForm />

                <div className="text-center text-xs text-zinc-600">
                    By signing in, I agree to allow face analysis on my photos.
                </div>
            </div>
        </div>
    );
}

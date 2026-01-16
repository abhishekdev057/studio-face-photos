"use server"
import { signIn } from "@/auth"

export async function doGoogleLogin() {
    await signIn("google", { redirectTo: "/organizer" })
}

"use server"
import { signOut } from "@/auth"

export async function doLogout() {
    await signOut({ redirectTo: "/login" });
}

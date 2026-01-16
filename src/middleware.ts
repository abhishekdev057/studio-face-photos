import NextAuth from "next-auth"
import authConfig from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
    const { nextUrl } = req;
    const user = req.auth?.user;

    // Protect /organizer routes
    if (nextUrl.pathname.startsWith('/organizer')) {
        if (!user) {
            return NextResponse.redirect(new URL('/login', nextUrl));
        }
        // Check role from session (populated from JWT in auth.ts logic)
        const role = (user as any).role;
        if (role !== 'ADMIN' && role !== 'ORGANIZER') {
            return NextResponse.redirect(new URL('/guest', nextUrl));
        }
    }

    // Protect /guest routes
    if (nextUrl.pathname.startsWith('/guest')) {
        if (!user) {
            return NextResponse.redirect(new URL('/login', nextUrl));
        }
    }

    return NextResponse.next();
})

export const config = {
    matcher: ['/organizer/:path*', '/guest/:path*'],
};

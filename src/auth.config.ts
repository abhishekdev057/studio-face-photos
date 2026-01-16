import Google from "next-auth/providers/google"
import type { NextAuthConfig } from "next-auth"

export default {
    providers: [
        Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
        })
    ],
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                // User object from adapter contains the role
                token.role = (user as any).role;

                const ADMIN_EMAIL = "abhishekdev057@gmail.com";
                if (user.email === ADMIN_EMAIL) {
                    token.role = 'ADMIN';
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
                (session.user as any).role = token.role;
            }
            return session;
        }
    }
} satisfies NextAuthConfig


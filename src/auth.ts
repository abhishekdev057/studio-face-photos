import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import authConfig from "./auth.config"

const ADMIN_EMAIL = "abhishekdev057@gmail.com";

export const { handlers, signIn, signOut, auth } = NextAuth({
    adapter: PrismaAdapter(prisma),
    session: { strategy: "jwt" },
    ...authConfig,
    callbacks: {
        async jwt({ token, user, trigger, session }) {
            if (user) {
                // User object from adapter contains the role
                token.role = (user as any).role;

                // Force Admin Role in Token if email matches (fixes first-login race condition)
                if (user.email === ADMIN_EMAIL) {
                    token.role = 'ADMIN';
                }
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub;
                // Inject role into session.user
                (session.user as any).role = token.role;
            }
            return session;
        },
        async signIn({ user }) {
            // Logic to auto-promote admin
            if (user.email === ADMIN_EMAIL) {
                try {
                    // We can use prisma here because auth.ts runs on Node
                    const existingUser = await prisma.user.findUnique({ where: { email: user.email } });
                    if (existingUser && existingUser.role !== 'ADMIN') {
                        await prisma.user.update({
                            where: { email: user.email },
                            data: { role: 'ADMIN' }
                        });
                    }
                } catch (e) {
                    // Ignore error on first sign in (user might not exist yet)
                }
            }
            return true;
        }
    },
    events: {
        createUser: async (message) => {
            const { user } = message;
            if (user.email === ADMIN_EMAIL) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { role: 'ADMIN' }
                });
            }
        }
    }
})

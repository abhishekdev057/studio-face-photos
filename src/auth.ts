import { PrismaAdapter } from "@auth/prisma-adapter";
import { Role } from "@prisma/client";
import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/slug";
import authConfig from "./auth.config";

const ADMIN_EMAIL = "abhishekdev057@gmail.com";

function isAdminEmail(email?: string | null) {
  return !!email && normalizeEmail(email) === normalizeEmail(ADMIN_EMAIL);
}

async function syncWorkspaceInvites(userId: string, email?: string | null) {
  if (!email) {
    return;
  }

  const normalizedEmail = normalizeEmail(email);
  const invites = await prisma.eventInvite.findMany({
    where: {
      email: normalizedEmail,
      claimedAt: null,
    },
    select: {
      id: true,
      eventId: true,
      role: true,
    },
  });

  if (invites.length === 0) {
    return;
  }

  await prisma.$transaction(
    invites.flatMap((invite) => [
      prisma.eventMember.upsert({
        where: {
          eventId_userId: {
            eventId: invite.eventId,
            userId,
          },
        },
        create: {
          eventId: invite.eventId,
          userId,
          role: invite.role,
        },
        update: {
          role: invite.role,
        },
      }),
      prisma.eventInvite.update({
        where: { id: invite.id },
        data: {
          claimedById: userId,
          claimedAt: new Date(),
        },
      }),
    ]),
  );

  if (invites.some((invite) => invite.role !== "VIEWER")) {
    await prisma.user.updateMany({
      where: {
        id: userId,
        role: "VIEWER",
      },
      data: {
        role: "ORGANIZER",
      },
    });
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma) as Adapter,
  session: { strategy: "jwt" },
  ...authConfig,
  callbacks: {
    async jwt({ token, user }) {
      const normalizedEmail = user?.email ?? token.email;

      if (isAdminEmail(normalizedEmail)) {
        token.role = "ADMIN";
        return token;
      }

      if (user) {
        token.role = user.role ?? "VIEWER";
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            role: true,
            email: true,
          },
        });

        session.user.id = token.sub;
        session.user.role = isAdminEmail(dbUser?.email ?? session.user.email ?? token.email)
          ? "ADMIN"
          : dbUser?.role ?? (token.role as Role | undefined) ?? "VIEWER";
      }

      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) {
        return;
      }

      if (isAdminEmail(user.email)) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: "ADMIN" },
        });
      }

      await syncWorkspaceInvites(user.id, user.email);
    },
    async signIn({ user }) {
      if (!user.id) {
        return;
      }

      if (isAdminEmail(user.email)) {
        await prisma.user.updateMany({
          where: {
            id: user.id,
            role: {
              not: "ADMIN",
            },
          },
          data: {
            role: "ADMIN",
          },
        });
      }

      await syncWorkspaceInvites(user.id, user.email);
    },
  },
});

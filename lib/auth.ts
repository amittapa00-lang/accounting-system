import type { NextAuthOptions, Session } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/** Session lifetime. Kept to a working day so a disabled account loses access quickly. */
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",

      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(credentials.password, user.password);

        if (!passwordMatch) {
          return null;
        }

        return {
          id: user.id,
          name: user.name ?? user.username,
          username: user.username,
          role: user.role,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.role = token.role;
      }

      return session;
    },
  },

  pages: {
    signIn: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default authOptions;

/**
 * The current session, but only if the user still exists and is active.
 * The JWT alone is not enough: an account disabled after login would keep working until expiry.
 */
export async function getActiveSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true, role: true },
  });

  if (!user || !user.isActive) {
    return null;
  }

  session.user.role = user.role;
  return session;
}

/** For pages (server components): returns the session or redirects to /login. */
export async function requirePageSession(): Promise<Session> {
  const session = await getActiveSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

/**
 * For route handlers: returns the session or throws ApiError(401).
 * Call it inside the handler's try block so handleApiError turns it into a 401 response.
 */
export async function requireApiSession(): Promise<Session> {
  const session = await getActiveSession();

  if (!session) {
    throw new ApiError(401, "กรุณาเข้าสู่ระบบก่อน");
  }

  return session;
}

import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

export const authOptions: NextAuthOptions = {
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		}),
	],
	secret: process.env.NEXTAUTH_SECRET,
	callbacks: {
		async signIn({ user }) {
			if (!user?.email) return false;

			// Insert only if missing
			await db
				.insert(users)
				.values({
					email: user.email,
					name: user.name,
					image: user.image,
				})
				.onConflictDoNothing();

			return true;
		},

		// Store app's internal user ID in the token
		async jwt({ token }) {
			// Skip DB if we already have user id cached
			if (!token.id && token.email) {
				const [existingUser] = await db
					.select({ id: users.id })
					.from(users)
					.where(eq(users.email, token.email))
					.limit(1);
				if (existingUser) token.id = existingUser.id;
			}
			return token;
		},

		// Inject it into session
		async session({ session, token }: { session: Session; token: JWT }) {
			if (session.user && token.id) {
				session.user.id = token.id as string;
			}
			return session;
		},
	},
};

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
		async signIn({ user }: { user: User }) {
			if (!user?.email) return false;

			const existingUser = await db
				.select()
				.from(users)
				.where(eq(users.email, user.email));

			if (existingUser.length === 0) {
				await db.insert(users).values({
					email: user.email,
					name: user.name,
					image: user.image,
				});
			}

			return true;
		},

		// Store app's internal user ID in the token
		async jwt({ token }) {
			if (token.email) {
				const existingUser = await db
					.select()
					.from(users)
					.where(eq(users.email, token.email));

				if (existingUser.length > 0) {
					token.id = existingUser[0].id; // This is your app's UUID
				}
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

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

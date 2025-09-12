import Sidebar from "./sidebar";
import { db } from "@/db/client";
import { threads } from "@/db/schema";
import { users } from "@/db/schema";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { eq } from "drizzle-orm";

export default async function SidebarWrapper() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.email) return null;

	const user = await db
		.select()
		.from(users)
		.where(eq(users.email, session.user.email))
		.then((rows) => rows[0]);

	if (!user) return null;

	const userThreads = await db
		.select()
		.from(threads)
		.where(eq(threads.userId, user.id));

	const sortedThreads = userThreads.reverse();

	return <Sidebar threads={sortedThreads} />;
}

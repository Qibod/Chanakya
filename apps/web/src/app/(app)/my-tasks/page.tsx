import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

async function getCurrentRole(): Promise<string | null> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = process.env["NODE_ENV"] === "production" ? "https" : "http";

  try {
    const res = await fetch(`${protocol}://${host}/api/v1/me`, {
      headers: { cookie: headersList.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { role?: string };
    return body.role ?? null;
  } catch {
    return null;
  }
}

export default async function MyTasksPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await getCurrentRole();
  if (role !== "ControlOwner") redirect("/dashboard");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100">My Tasks</h1>
      <p className="mt-2 text-slate-400">Full implementation in Story 3.4</p>
    </div>
  );
}

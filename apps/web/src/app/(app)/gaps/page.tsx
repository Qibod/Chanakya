import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { GapsClient } from "@/features/gaps/GapsClient";

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

export default async function GapsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await getCurrentRole();
  if (role !== "AuditDirector") redirect("/dashboard");

  return <GapsClient />;
}


import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

const ROLE_ROUTES: Record<string, string> = {
  OrgAdmin: "/dashboard",
  AuditDirector: "/dashboard",
  ControlOwner: "/my-tasks",
  Developer: "/developer",
  ReadOnly: "/dashboard",
  BoardExecutive: "/dashboard",
  ExternalAuditor: "/dashboard",
  PlatformSuperAdmin: "/dashboard",
};

export default async function HomePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = process.env["NODE_ENV"] === "production" ? "https" : "http";

  try {
    // Loopback via the BFF proxy so Clerk session cookie is forwarded correctly.
    // Assumes Vercel/Cloud Run resolves `host` to the same deployment — if running
    // in a split-service topology use INTERNAL_API_URL directly and pass the token instead.
    const res = await fetch(`${protocol}://${host}/api/v1/me`, {
      headers: { cookie: headersList.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json()) as { role?: string };
      if (body.role) {
        redirect(ROLE_ROUTES[body.role] ?? "/dashboard");
      }
    }
  } catch {
    // BFF unavailable (e.g. first provision) — fall through to default
  }

  redirect("/dashboard");
}

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { OnboardingBanner } from "@/features/onboarding/OnboardingBanner";
import type { UserRole } from "@grc/types";

async function getUserRole(): Promise<UserRole | undefined> {
  const { userId } = await auth();
  if (!userId) return undefined;

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = process.env["NODE_ENV"] === "production" ? "https" : "http";

  try {
    const res = await fetch(`${protocol}://${host}/api/v1/me`, {
      headers: { cookie: headersList.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json()) as { role?: string };
      return body.role as UserRole | undefined;
    }
  } catch {
    // BFF unavailable
  }
  return undefined;
}

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const role = await getUserRole();

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Sidebar */}
      <Sidebar role={role} />

      {/* Main content + top nav */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav />
        <main id="main-content" className="flex-1 overflow-y-auto p-6">
          <OnboardingBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

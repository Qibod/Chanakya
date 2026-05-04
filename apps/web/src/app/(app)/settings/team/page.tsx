import { headers } from "next/headers";
import { UserTable } from "./UserTable";

interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string | null;
  active: boolean;
}

async function getUsers(): Promise<TeamUser[]> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = process.env["NODE_ENV"] === "production" ? "https" : "http";

  try {
    const res = await fetch(`${protocol}://${host}/api/v1/users`, {
      headers: { cookie: headersList.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json()) as { data?: TeamUser[] };
      return body.data ?? [];
    }
  } catch {
    // BFF unavailable
  }
  return [];
}

export default async function TeamSettingsPage() {
  const users = await getUsers();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-100">Team</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your organisation&apos;s users and their roles.
        </p>
      </div>

      <UserTable initialUsers={users} />
    </div>
  );
}

import Link from "next/link";

/** Shell route so onboarding links never 404; full catalog UX ships in Epic 4 (Story 4.4). */
export default function IntegrationsPage() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[40vh] max-w-2xl flex-col gap-6 px-4 py-12"
    >
      <h1 className="text-foreground text-2xl font-semibold tracking-tight">Integrations</h1>
      <p className="text-foreground-secondary text-sm leading-relaxed">
        Connect Okta, AWS, Jira, and other systems for automated evidence collection. Detailed setup
        and health monitoring will appear here as the platform grows.
      </p>
      <Link href="/dashboard" className="text-accent text-sm font-medium underline hover:text-accent-hover">
        Back to dashboard
      </Link>
    </main>
  );
}

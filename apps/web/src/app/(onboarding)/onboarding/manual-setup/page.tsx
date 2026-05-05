import Link from "next/link";

/** Fallback when AI fingerprinting fails or user prefers manual configuration (Story 2.2). */
export default function ManualSetupPage() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[50vh] max-w-lg flex-col gap-6 px-4 py-16"
    >
      <h1 className="text-foreground text-2xl font-semibold tracking-tight">
        Manual setup
      </h1>
      <p className="text-foreground-secondary text-sm leading-relaxed">
        Configure your organisation without AI fingerprinting. You can invite teammates and
        connect integrations from the dashboard.
      </p>
      <ul className="text-accent flex flex-col gap-3 text-sm font-medium">
        <li>
          <Link href="/dashboard" className="underline hover:text-accent-hover">
            Go to dashboard
          </Link>
        </li>
        <li>
          <Link href="/onboarding/fingerprint" className="underline hover:text-accent-hover">
            Back to fingerprinting
          </Link>
        </li>
      </ul>
    </main>
  );
}

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/onboarding(.*)",
  "/dashboard(.*)",
  "/my-tasks(.*)",
  "/controls(.*)",
  "/settings(.*)",
  "/developer(.*)",
  "/audits(.*)",
  "/evidence(.*)",
  "/risk(.*)",
  "/integrations(.*)",
  "/reports(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

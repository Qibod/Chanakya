import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

type RouteContext = { params: Promise<{ path: string[] }> };

const API_BASE = process.env["INTERNAL_API_URL"] ?? "http://localhost:3001";

async function proxyRequest(
  request: NextRequest,
  { params }: RouteContext,
  method: string
): Promise<NextResponse> {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  }

  const { path } = await params;
  const token = await getToken();

  const upstreamUrl = new URL(`/v1/${path.join("/")}`, API_BASE);
  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const init: RequestInit = { method, headers, cache: "no-store" };

  if (method !== "GET" && method !== "DELETE") {
    try {
      const body = await request.text();
      if (body) init.body = body;
    } catch {
      // no body
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl.toString(), init);
  } catch {
    return NextResponse.json({ error: { code: "UPSTREAM_UNAVAILABLE" } }, { status: 502 });
  }

  // Pass through non-JSON responses (e.g. 204 No Content)
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context, "GET");
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context, "POST");
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context, "PATCH");
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context, "PUT");
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context, "DELETE");
}

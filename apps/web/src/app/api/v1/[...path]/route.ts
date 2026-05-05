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
  };
  if (method !== "GET" && method !== "DELETE") {
    // Assumes all mutating requests carry JSON bodies — multipart/form-data not supported here.
    headers["Content-Type"] = "application/json";
  }

  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
    signal: request.signal,
  };

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

  const upstreamContentType = upstream.headers.get("content-type") ?? "";
  if (upstreamContentType.includes("text/event-stream")) {
    if (!upstream.body) {
      return NextResponse.json(
        { error: { code: "STREAM_UNAVAILABLE", message: "Upstream stream has no body" } },
        { status: 502 }
      );
    }
    const passthroughHeaders = new Headers();
    passthroughHeaders.set("Content-Type", "text/event-stream");
    passthroughHeaders.set("Cache-Control", "no-cache");
    passthroughHeaders.set("Connection", "keep-alive");
    passthroughHeaders.set("X-Accel-Buffering", "no");
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: passthroughHeaders,
    });
  }

  try {
    const data: unknown = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json(
      { error: { code: "UPSTREAM_INVALID_RESPONSE", message: "Upstream returned non-JSON body" } },
      { status: 502 }
    );
  }
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

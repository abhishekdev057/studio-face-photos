import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { searchPhotos } from "@/actions/search";
import { normalizeDescriptor } from "@/lib/faceMatching";
import { consumeRateLimit } from "@/lib/rateLimit";

const SEARCH_LIMIT = 12;
const SEARCH_WINDOW_MS = 60_000;

export const runtime = "nodejs";

function getClientFingerprint(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  return crypto.createHash("sha256").update(`${ip}:${userAgent}`).digest("hex");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as { descriptor?: number[] };
    const descriptor = Array.isArray(body?.descriptor) ? body.descriptor : [];
    const normalizedDescriptor = normalizeDescriptor(descriptor);
    if (!normalizedDescriptor) {
      return NextResponse.json(
        { success: false, error: "A clear camera face is required." },
        { status: 400 },
      );
    }

    const fingerprint = getClientFingerprint(request);
    const rateLimit = consumeRateLimit(
      `public-search:${slug}:${fingerprint}`,
      SEARCH_LIMIT,
      SEARCH_WINDOW_MS,
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many searches. Please wait a moment and try again.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          },
        },
      );
    }

    const result = await searchPhotos(slug, normalizedDescriptor);
    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Public search API failed", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Search failed.",
      },
      { status: 500 },
    );
  }
}

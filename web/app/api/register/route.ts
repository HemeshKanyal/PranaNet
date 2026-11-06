// Same-origin proxy to the relayer's POST /register (or the mock response).
// The IDKit result is passed through unchanged; the relayer verifies it server-side.
import { NextResponse } from "next/server";
import { register } from "@/lib/relayer";
import type { RegisterRequest } from "@/lib/types";

export async function POST(req: Request) {
  let body: RegisterRequest;
  try {
    body = (await req.json()) as RegisterRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  if (!/^0x[0-9a-f]{40}$/.test(body.device ?? "")) return NextResponse.json({ ok: false, error: "bad_device" }, { status: 400 });
  if (!/^[a-z0-9-]{3,32}$/.test(body.label ?? "")) return NextResponse.json({ ok: false, error: "bad_label" }, { status: 400 });
  if (!/^[0-9b-hjkmnp-z]{6}$/.test(body.geohash ?? "")) return NextResponse.json({ ok: false, error: "bad_geohash" }, { status: 400 });
  if (!body.idkit) return NextResponse.json({ ok: false, error: "missing_proof" }, { status: 400 });
  try {
    return NextResponse.json(await register(body));
  } catch {
    return NextResponse.json({ ok: false, error: "relayer_unreachable" }, { status: 502 });
  }
}

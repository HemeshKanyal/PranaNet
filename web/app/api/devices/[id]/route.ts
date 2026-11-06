// Same-origin proxy so client components can load a device's history without CORS.
import { NextResponse } from "next/server";
import { resolveDevice } from "@/lib/relayer";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await resolveDevice(decodeURIComponent(id));
  if (!d) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(d, { headers: { "cache-control": "no-store" } });
}

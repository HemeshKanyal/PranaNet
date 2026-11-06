// IDKit 4 needs an rp_context signed by the relying party's key on the server.
// The key never reaches the browser. Without WLD_RP_SIGNING_KEY the register page uses a
// simulated proof instead (mock mode).
import { NextResponse } from "next/server";
import { signRequest } from "@worldcoin/idkit/signing";

export async function GET() {
  const key = process.env.WLD_RP_SIGNING_KEY;
  const rpId = process.env.WLD_RP_ID;
  if (!key || !rpId) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const action = process.env.NEXT_PUBLIC_WLD_ACTION || "register-device";
  const sig = signRequest({ signingKeyHex: key, action, ttl: 300 });
  return NextResponse.json(
    { rp_id: rpId, nonce: sig.nonce, created_at: sig.createdAt, expires_at: sig.expiresAt, signature: sig.sig },
    { headers: { "cache-control": "no-store" } },
  );
}

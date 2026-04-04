import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Base64url-encode a Uint8Array. */
function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Import a base64url-encoded raw ECDSA P-256 private key for signing. */
async function importVapidPrivateKey(b64: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: base64urlEncode(raw),
    x: "",
    y: "",
  };

  // Derive public key x,y from the full VAPID public key
  const pubRaw = Uint8Array.from(
    atob(requireEnv("VAPID_PUBLIC_KEY").replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  // Uncompressed public key: 0x04 || x (32 bytes) || y (32 bytes)
  jwk.x = base64urlEncode(pubRaw.slice(1, 33));
  jwk.y = base64urlEncode(pubRaw.slice(33, 65));

  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

/** Create a signed VAPID JWT. */
async function createVapidJwt(audience: string, subject: string, privateKey: CryptoKey): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const enc = new TextEncoder();
  const headerB64 = base64urlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(enc.encode(JSON.stringify(payload)));
  const unsigned = `${headerB64}.${payloadB64}`;

  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, enc.encode(unsigned)),
  );

  // WebCrypto returns DER-encoded signature; convert to raw r||s (64 bytes)
  const rawSig = derToRaw(sig);
  return `${unsigned}.${base64urlEncode(rawSig)}`;
}

function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 <len> 0x02 <rLen> <r> 0x02 <sLen> <s>
  const raw = new Uint8Array(64);
  let offset = 2;
  const rLen = der[offset + 1];
  const rStart = offset + 2 + (rLen > 32 ? rLen - 32 : 0);
  const rBytes = rLen > 32 ? 32 : rLen;
  raw.set(der.slice(rStart, rStart + rBytes), 32 - rBytes);

  offset = offset + 2 + rLen;
  const sLen = der[offset + 1];
  const sStart = offset + 2 + (sLen > 32 ? sLen - 32 : 0);
  const sBytes = sLen > 32 ? 32 : sLen;
  raw.set(der.slice(sStart, sStart + sBytes), 64 - sBytes);
  return raw;
}

async function sendWebPush(
  subscription: { endpoint: string; keys_p256dh: string; keys_auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: CryptoKey,
  vapidSubject: string,
): Promise<Response> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await createVapidJwt(audience, vapidSubject, vapidPrivateKey);

  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    },
    body: new TextEncoder().encode(payload),
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, mission_id, title, body: notifBody } = await req.json();
    if (!user_id) return json({ error: "user_id required" }, 400);

    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const vapidPublicKey = requireEnv("VAPID_PUBLIC_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:noreply@tether0.vercel.app";
    const vapidPrivateKey = await importVapidPrivateKey(requireEnv("VAPID_PRIVATE_KEY"));

    const { data: subs, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, keys_p256dh, keys_auth")
      .eq("user_id", user_id);

    if (subErr) throw subErr;
    if (!subs || subs.length === 0) {
      return json({ sent: 0, message: "No push subscriptions for this user" });
    }

    const payload = JSON.stringify({
      title: title || "Mission Approval Required",
      body: notifBody || "A new mission needs your approval.",
      url: mission_id ? `/approve?mission=${mission_id}` : "/approve",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
    });

    let sent = 0;
    const staleIds: string[] = [];

    for (const sub of subs) {
      try {
        const res = await sendWebPush(sub, payload, vapidPublicKey, vapidPrivateKey, vapidSubject);
        if (res.ok || res.status === 201) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          staleIds.push(sub.id);
        } else {
          console.error(`Push failed for ${sub.endpoint}: ${res.status} ${await res.text()}`);
        }
      } catch (e) {
        console.error(`Push error for ${sub.endpoint}:`, e);
      }
    }

    if (staleIds.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", staleIds);
    }

    return json({ sent, cleaned: staleIds.length });
  } catch (error) {
    console.error("send-push error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

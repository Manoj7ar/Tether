/**
 * Send Web Push notifications to a user's subscribed devices.
 *
 * Uses VAPID authentication and RFC 8291 (aes128gcm) payload encryption
 * implemented with Web Crypto (available in Deno / Edge Functions).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s + "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

// ── VAPID ───────────────────────────────────────────────────────────────

async function importVapidPrivateKey(b64: string, pubB64: string): Promise<CryptoKey> {
  const d = b64urlDecode(b64);
  const pub = b64urlDecode(pubB64);
  const jwk: JsonWebKey = {
    kty: "EC", crv: "P-256",
    d: b64url(d),
    x: b64url(pub.slice(1, 33)),
    y: b64url(pub.slice(33, 65)),
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

function derToRaw(der: Uint8Array): Uint8Array {
  const raw = new Uint8Array(64);
  let off = 2;
  const rLen = der[off + 1];
  const rStart = off + 2 + Math.max(0, rLen - 32);
  raw.set(der.slice(rStart, rStart + Math.min(rLen, 32)), 32 - Math.min(rLen, 32));
  off += 2 + rLen;
  const sLen = der[off + 1];
  const sStart = off + 2 + Math.max(0, sLen - 32);
  raw.set(der.slice(sStart, sStart + Math.min(sLen, 32)), 64 - Math.min(sLen, 32));
  return raw;
}

async function vapidAuthHeader(
  endpoint: string,
  subject: string,
  privateKey: CryptoKey,
  publicKeyB64: string,
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const enc = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  const hdr = b64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const pay = b64url(enc.encode(JSON.stringify({ aud: audience, exp: now + 86400, sub: subject })));
  const unsigned = `${hdr}.${pay}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, enc.encode(unsigned)),
  );
  return `vapid t=${unsigned}.${b64url(derToRaw(sig))}, k=${publicKeyB64}`;
}

// ── RFC 8291 aes128gcm Encryption ───────────────────────────────────────

async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", salt.length ? salt : new Uint8Array(32), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt.length ? salt : new Uint8Array(32), info },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

async function hkdfFromIkm(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const prk = await crypto.subtle.importKey("raw", ikm, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prkSigned = new Uint8Array(await crypto.subtle.sign("HMAC", prk, salt.length ? salt : new Uint8Array(32)));
  // Now use PRK as HKDF salt isn't directly usable with deriveBits for IKM input
  // Use manual HKDF-Expand
  const prkKey = await crypto.subtle.importKey("raw", prkSigned, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);

  // Actually, let's do proper HKDF: Extract then Expand
  // Extract: PRK = HMAC-Hash(salt, IKM)
  const extractKey = await crypto.subtle.importKey(
    "raw", salt.length ? salt : new Uint8Array(32),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const prkBytes = new Uint8Array(await crypto.subtle.sign("HMAC", extractKey, ikm));

  // Expand
  const expandKey = await crypto.subtle.importKey(
    "raw", prkBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const infoWithCounter = concat(info, new Uint8Array([1]));
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", expandKey, infoWithCounter));
  return okm.slice(0, length);
}

function createInfo(
  type: string,
  clientPublicKey: Uint8Array,
  serverPublicKey: Uint8Array,
): Uint8Array {
  const enc = new TextEncoder();
  const typeBytes = enc.encode(type);
  const header = enc.encode("Content-Encoding: ");
  const nul = new Uint8Array([0]);

  return concat(
    header,
    typeBytes,
    nul,
    new Uint8Array([0, 0, 0x41]),
    clientPublicKey,
    new Uint8Array([0, 0x41]),
    serverPublicKey,
  );
}

async function encryptPayload(
  plaintext: Uint8Array,
  clientPublicKeyB64: string,
  authSecretB64: string,
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const clientPublicKeyBytes = b64urlDecode(clientPublicKeyB64);
  const authSecret = b64urlDecode(authSecretB64);

  // Generate ephemeral ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    "raw", clientPublicKeyBytes, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientPublicKey }, localKeyPair.privateKey, 256),
  );

  // Salt for the encryption
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // IKM (input keying material) via HKDF with auth secret
  const enc = new TextEncoder();
  const ikmInfo = concat(enc.encode("WebPush: info\0"), clientPublicKeyBytes, localPublicKeyRaw);
  const ikm = await hkdfFromIkm(sharedSecret, authSecret, ikmInfo, 32);

  // Derive CEK (content encryption key) and nonce
  const cekInfo = concat(enc.encode("Content-Encoding: aes128gcm\0"));
  const cek = await hkdfFromIkm(ikm, salt, cekInfo, 16);

  const nonceInfo = concat(enc.encode("Content-Encoding: nonce\0"));
  const nonce = await hkdfFromIkm(ikm, salt, nonceInfo, 12);

  // Pad plaintext: add delimiter byte 0x02 (aes128gcm)
  const padded = concat(plaintext, new Uint8Array([2]));

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, padded),
  );

  return { ciphertext: encrypted, salt, localPublicKey: localPublicKeyRaw };
}

function buildAes128GcmBody(
  salt: Uint8Array,
  localPublicKey: Uint8Array,
  ciphertext: Uint8Array,
): Uint8Array {
  // Header: salt(16) + rs(4) + keyIdLen(1) + keyId(65) + ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096, false);
  const keyIdLen = new Uint8Array([65]);

  return concat(salt, rs, keyIdLen, localPublicKey, ciphertext);
}

// ── Main ────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, mission_id, title, body: notifBody } = await req.json();
    if (!user_id) return json({ error: "user_id required" }, 400);

    const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const vapidPublicKey = requireEnv("VAPID_PUBLIC_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:noreply@tether0.vercel.app";
    const vapidPrivateKey = await importVapidPrivateKey(requireEnv("VAPID_PRIVATE_KEY"), vapidPublicKey);

    const { data: subs, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, keys_p256dh, keys_auth")
      .eq("user_id", user_id);

    if (subErr) throw subErr;
    if (!subs || subs.length === 0) {
      return json({ sent: 0, message: "No push subscriptions for this user" });
    }

    const payloadJson = JSON.stringify({
      title: title || "Mission Approval Required",
      body: notifBody || "A new mission needs your approval.",
      url: mission_id ? `/approve?mission=${mission_id}` : "/approve",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
    });
    const payloadBytes = new TextEncoder().encode(payloadJson);

    let sent = 0;
    const staleIds: string[] = [];

    for (const sub of subs) {
      try {
        const { ciphertext, salt, localPublicKey } = await encryptPayload(
          payloadBytes,
          sub.keys_p256dh,
          sub.keys_auth,
        );
        const body = buildAes128GcmBody(salt, localPublicKey, ciphertext);
        const authHeader = await vapidAuthHeader(sub.endpoint, vapidSubject, vapidPrivateKey, vapidPublicKey);

        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            TTL: "86400",
            Authorization: authHeader,
          },
          body,
        });

        if (res.ok || res.status === 201) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          staleIds.push(sub.id);
        } else {
          const text = await res.text().catch(() => "");
          console.error(`Push failed for ${sub.endpoint}: ${res.status} ${text}`);
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

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getEncryptionKeyMaterial() {
  const rawKey = Deno.env.get("TOKEN_ENCRYPTION_KEY");
  if (!rawKey) {
    throw new Error("TOKEN_ENCRYPTION_KEY is not configured");
  }

  return Uint8Array.from(atob(rawKey), (char) => char.charCodeAt(0));
}

async function importKey() {
  return crypto.subtle.importKey(
    "raw",
    getEncryptionKeyMaterial(),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );

  const packed = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ciphertext), iv.byteLength);

  return btoa(String.fromCharCode(...packed));
}

export async function decryptSecret(ciphertext: string | null | undefined): Promise<string | null> {
  if (!ciphertext) return null;

  const key = await importKey();
  const bytes = Uint8Array.from(atob(ciphertext), (char) => char.charCodeAt(0));
  const iv = bytes.slice(0, 12);
  const payload = bytes.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    payload,
  );

  return decoder.decode(decrypted);
}

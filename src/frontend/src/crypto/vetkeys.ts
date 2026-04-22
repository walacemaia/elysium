/**
 * VetKeys cryptography utilities for Elysium
 *
 * Provides end-to-end encryption of note content using the IC vetKD protocol.
 * The backend never sees plaintext — all encryption/decryption happens in the browser.
 *
 * Protocol (must match the backend vetKD calls exactly):
 *
 *   Backend vetkd_public_key(cofreId):
 *     → ManagementCanister.vetKdPublicKey(null, context=[], keyId)
 *     → returns DerivedPublicKey for the canister's BASE key (empty context)
 *
 *   Backend vetkd_encrypted_key(tpk, cofreId):
 *     → ManagementCanister.vetKdDeriveKey(input=cofreIdToBytes(cofreId), context=[], keyId, tpk)
 *     → returns BLS.sign(DPK_empty_context, cofreIdBytes) encrypted under tpk
 *
 *   Frontend decryptAndVerify(tsk, dpk, derivationId):
 *     → derivationId MUST equal the `input` passed to vetKdDeriveKey = cofreIdToBytes(cofreId)
 *     → dpk MUST be derived with the same `context` as used in vetKdDeriveKey = [] (empty)
 *     → verifies BLS.verify(dpk, dpk.publicKeyBytes() || derivationId, vetKey)
 *
 *   Therefore: dpk = DPK from vetkd_public_key (context=[]) ✓
 *              derivationId = cofreIdToBytes(cofreId) ✓
 *
 * Flow:
 *   1. Generate a TransportSecretKey per session
 *   2. For each cofre, fetch the DerivedPublicKey (base key) and EncryptedVetKey from backend
 *   3. Decrypt the VetKey locally using the transport key and cofreId bytes as derivation ID
 *   4. Derive a per-cofre AES-GCM CryptoKey from the VetKey via HKDF
 *   5. Encrypt/decrypt note fields with AES-GCM
 *
 * SECURITY INVARIANTS:
 *   - encryptNote() throws on any failure — notes are NEVER stored as plaintext fallback
 *   - decryptNote() distinguishes between encrypted notes (shows error) and legacy plaintext (shows as-is)
 *   - vetKeyCache can be selectively invalidated per cofre via clearVetKeyForCofre()
 */

import {
  DerivedPublicKey,
  EncryptedVetKey,
  TransportSecretKey,
} from "@dfinity/vetkeys";

// Domain separator for key derivation — unique to Elysium notes
const DOMAIN_SEP = "elysium-notes-v1";

/**
 * Encodes a bigint cofreId as a minimal big-endian Uint8Array.
 *
 * This MUST match the backend cofreIdToBytes (main.mo) exactly:
 *   - id == 0  → [0x00]  (1 byte)
 *   - id  > 0  → variable-length big-endian, no leading zeros
 *     e.g. 1 → [0x01], 256 → [0x01, 0x00], 1000 → [0x03, 0xE8]
 *
 * The bytes are passed as the derivation_id (3rd arg) to
 * EncryptedVetKey.decryptAndVerify(), which must equal the input
 * the backend passed to ManagementCanister.vetKdDeriveKey / vetKdPublicKey.
 */
export function cofreIdToBytes(cofreId: bigint): Uint8Array {
  if (cofreId === 0n) {
    return new Uint8Array([0x00]);
  }
  // Collect bytes least-significant first, then reverse (big-endian, no padding)
  const lsbFirst: number[] = [];
  let val = cofreId;
  while (val > 0n) {
    lsbFirst.push(Number(val & 0xffn));
    val >>= 8n;
  }
  lsbFirst.reverse();
  return new Uint8Array(lsbFirst);
}

/**
 * Creates a new random TransportSecretKey for the current session.
 */
export function generateTransportKey(): TransportSecretKey {
  return TransportSecretKey.random();
}

// Per-session cache: cofreId string → CryptoKey
const vetKeyCache = new Map<string, CryptoKey>();

/**
 * Retrieves (and caches) the AES-GCM CryptoKey for a given cofre.
 *
 * Steps:
 *   1. actor.vetkd_public_key(cofreId)  → DerivedPublicKey bytes
 *   2. actor.vetkd_encrypted_key(tpk, cofreId) → EncryptedVetKey bytes
 *   3. EncryptedVetKey.decryptAndVerify(tsk, dpk, input) → VetKey
 *   4. vetKey.asDerivedKeyMaterial().deriveAesGcmCryptoKey(domainSep)
 */
export async function getVetKey(
  cofreId: bigint,
  actor: {
    vetkd_public_key: (id: bigint) => Promise<Uint8Array | number[]>;
    vetkd_encrypted_key: (
      tpk: Uint8Array | number[],
      id: bigint,
    ) => Promise<Uint8Array | number[]>;
  },
  transportKey: TransportSecretKey,
): Promise<CryptoKey> {
  const cacheKey = cofreId.toString();
  const cached = vetKeyCache.get(cacheKey);
  if (cached) return cached;

  const input = cofreIdToBytes(cofreId);

  // Fetch DerivedPublicKey from backend
  const pubKeyRaw = await actor.vetkd_public_key(cofreId);
  const pubKeyBytes =
    pubKeyRaw instanceof Uint8Array ? pubKeyRaw : new Uint8Array(pubKeyRaw);
  const dpk = DerivedPublicKey.deserialize(pubKeyBytes);

  // Fetch EncryptedVetKey from backend (transport public key sent for secure wrapping)
  const encKeyRaw = await actor.vetkd_encrypted_key(
    transportKey.publicKeyBytes(),
    cofreId,
  );
  const encKeyBytes =
    encKeyRaw instanceof Uint8Array ? encKeyRaw : new Uint8Array(encKeyRaw);

  // Decrypt VetKey locally
  const encryptedVetKey = EncryptedVetKey.deserialize(encKeyBytes);
  const vetKey = encryptedVetKey.decryptAndVerify(transportKey, dpk, input);

  // Derive a non-exportable AES-GCM key via HKDF
  const derivedKeyMaterial = await vetKey.asDerivedKeyMaterial();
  const cryptoKey = await derivedKeyMaterial.deriveAesGcmCryptoKey(DOMAIN_SEP);

  vetKeyCache.set(cacheKey, cryptoKey);
  return cryptoKey;
}

/**
 * Clears the entire vetKey cache. Call on logout.
 */
export function clearVetKeyCache(): void {
  vetKeyCache.clear();
}

/**
 * Invalidates the cached vetKey for a specific cofre.
 * Call after revoking a user's access or editing cofre authorization rules,
 * to ensure the stale key is not reused on the next operation.
 */
export function clearVetKeyForCofre(cofreId: bigint): void {
  vetKeyCache.delete(cofreId.toString());
}

/**
 * Encrypts plaintext with AES-GCM.
 * Returns a Base64 string encoding: [12-byte IV || ciphertext].
 */
export async function encryptText(
  text: string,
  cryptoKey: CryptoKey,
): Promise<string> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);

  const ciphertextBuf = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoded,
  );

  // Concatenate IV + ciphertext
  const combined = new Uint8Array(12 + ciphertextBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextBuf), 12);

  return uint8ArrayToBase64(combined);
}

/**
 * Decrypts a Base64 AES-GCM ciphertext (IV||ciphertext format).
 * Throws on failure — callers should handle gracefully for legacy plaintext.
 */
export async function decryptText(
  encryptedBase64: string,
  cryptoKey: CryptoKey,
): Promise<string> {
  const combined = base64ToUint8Array(encryptedBase64);

  if (combined.length < 13) {
    throw new Error("Ciphertext too short");
  }

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const plaintextBuf = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    ciphertext,
  );

  return new TextDecoder().decode(plaintextBuf);
}

/**
 * Returns true if the string looks like a vetKeys-encrypted note field.
 *
 * AES-GCM output format: [12-byte IV || ciphertext || 16-byte auth tag]
 * Minimum size: 12 + 1 + 16 = 29 bytes → Base64 ≥ 40 chars.
 * We use a conservative 24-char minimum on the raw Base64 string and then
 * verify the decoded byte length is at least 29.
 *
 * Heuristic (in order):
 *   1. value.length >= 24 (Base64 encoded string is long enough)
 *   2. Valid Base64 regex test (only Base64 chars, optional padding)
 *   3. Decoded bytes.length >= 29 (minimum valid AES-GCM output)
 */
export function looksEncrypted(value: string): boolean {
  if (value.length < 24) return false;
  // Check it's valid Base64
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return false;
  try {
    const bytes = base64ToUint8Array(value);
    // Minimum AES-GCM output: 12-byte IV + at least 1 byte data + 16-byte auth tag = 29 bytes
    if (bytes.length < 29) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypts both titulo and conteudo of a note for a given cofre.
 *
 * SECURITY: This function THROWS on any failure.
 * The note MUST NOT be saved if encryption cannot be performed.
 */
export async function encryptNote(
  cofreId: bigint,
  titulo: string,
  conteudo: string,
  actor: {
    vetkd_public_key: (id: bigint) => Promise<Uint8Array | number[]>;
    vetkd_encrypted_key: (
      tpk: Uint8Array | number[],
      id: bigint,
    ) => Promise<Uint8Array | number[]>;
  },
  transportKey: TransportSecretKey | null,
): Promise<{ tituloEnc: string; conteudoEnc: string }> {
  if (!transportKey) {
    throw new Error(
      "[vetkeys] TransportSecretKey not yet initialised — CryptoProvider may still be mounting",
    );
  }
  // Any error from getVetKey or encryptText propagates directly — no plaintext fallback
  const cryptoKey = await getVetKey(cofreId, actor, transportKey);
  const [tituloEnc, conteudoEnc] = await Promise.all([
    encryptText(titulo, cryptoKey),
    encryptText(conteudo, cryptoKey),
  ]);
  return { tituloEnc, conteudoEnc };
}

/**
 * Decrypts both titulo and conteudo of a note for a given cofre.
 *
 * Behaviour:
 *   - Legacy plaintext notes (not encrypted format): returned as-is, silently.
 *   - Encrypted notes where decryption fails: returns user-visible error strings.
 *   - transportKey not ready yet: returns as-is (UI will retry when key is available).
 */
export async function decryptNote(
  cofreId: bigint,
  tituloEnc: string,
  conteudoEnc: string,
  actor: {
    vetkd_public_key: (id: bigint) => Promise<Uint8Array | number[]>;
    vetkd_encrypted_key: (
      tpk: Uint8Array | number[],
      id: bigint,
    ) => Promise<Uint8Array | number[]>;
  },
  transportKey: TransportSecretKey | null,
): Promise<{ titulo: string; conteudo: string }> {
  const result = await decryptNoteWithStatus(
    cofreId,
    tituloEnc,
    conteudoEnc,
    actor,
    transportKey,
  );
  return { titulo: result.titulo, conteudo: result.conteudo };
}

/**
 * Decrypts both titulo and conteudo of a note and reports whether it was encrypted.
 *
 * The `isEncrypted` flag is set to `true` ONLY when:
 *   - At least one of the original stored values passes `looksEncrypted()` (checked
 *     on the raw ciphertext BEFORE any decryption), AND
 *   - Decryption succeeds.
 *
 * This is the correct place to set the flag because only here do we have access to
 * both the original ciphertext AND the decryption outcome in the same call.
 *
 * Callers should spread `isEncrypted` onto the Nota object for badge rendering.
 */
export async function decryptNoteWithStatus(
  cofreId: bigint,
  tituloEnc: string,
  conteudoEnc: string,
  actor: {
    vetkd_public_key: (id: bigint) => Promise<Uint8Array | number[]>;
    vetkd_encrypted_key: (
      tpk: Uint8Array | number[],
      id: bigint,
    ) => Promise<Uint8Array | number[]>;
  },
  transportKey: TransportSecretKey | null,
): Promise<{ titulo: string; conteudo: string; isEncrypted: boolean }> {
  if (!transportKey) {
    console.warn(
      "[vetkeys] decryptNote skipped — transportKey not yet ready for cofre",
      cofreId.toString(),
    );
    return { titulo: tituloEnc, conteudo: conteudoEnc, isEncrypted: false };
  }

  // Check the ORIGINAL stored values (ciphertext) — not the result after decryption
  const tituloIsEncrypted = looksEncrypted(tituloEnc);
  const conteudoIsEncrypted = looksEncrypted(conteudoEnc);

  // If neither field looks encrypted, this is a legacy plaintext note — return as-is
  if (!tituloIsEncrypted && !conteudoIsEncrypted) {
    return { titulo: tituloEnc, conteudo: conteudoEnc, isEncrypted: false };
  }

  // At least one field looks encrypted — attempt full decryption
  try {
    const cryptoKey = await getVetKey(cofreId, actor, transportKey);
    const [titulo, conteudo] = await Promise.all([
      tituloIsEncrypted
        ? decryptText(tituloEnc, cryptoKey)
        : Promise.resolve(tituloEnc),
      conteudoIsEncrypted
        ? decryptText(conteudoEnc, cryptoKey)
        : Promise.resolve(conteudoEnc),
    ]);
    // Decryption succeeded — flag this note as truly encrypted
    return { titulo, conteudo, isEncrypted: true };
  } catch (err) {
    // Decryption truly failed on a note that was stored encrypted — show explicit error
    console.error(
      "[vetkeys] decryptNote failed for encrypted nota in cofre",
      cofreId.toString(),
      err,
    );
    return {
      titulo: "[Erro: falha ao descriptografar]",
      conteudo:
        "[Conteúdo não pôde ser descriptografado. Verifique seu acesso ao cofre.]",
      isEncrypted: false,
    };
  }
}

// --- Base64 helpers ---

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

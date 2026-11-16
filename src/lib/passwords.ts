import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// scrypt at OWASP's minimum cost (N = 2^17, r = 8, p = 1). The parameters are
// stored with each hash, so they can be raised later without breaking logins:
// "scrypt$17$8$1$<salt>$<hash>", base64url.
const LOG_N = 17;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 64;
// A hash at these settings needs 128 * N * r bytes (128 MiB)
const MAX_MEMORY = 256 * 1024 * 1024;

function derive(password: string, salt: Buffer, logN: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // NFKC so the same password typed on another keyboard still matches
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { N: 2 ** logN, r, p, maxmem: MAX_MEMORY }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, LOG_N, BLOCK_SIZE, PARALLELISM);
  return ["scrypt", LOG_N, BLOCK_SIZE, PARALLELISM, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, logN, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const key = await derive(password, Buffer.from(salt, "base64url"), Number(logN), Number(r), Number(p));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Checked when no account has the email, so that a wrong email takes as long
// as a wrong password and the timing doesn't tell which emails have accounts
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString("base64url"));
  return dummyHash;
}

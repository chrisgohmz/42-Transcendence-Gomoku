import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const HASH_LENGTH = 64;
const SALT_LENGTH = 16;
const scrypt = promisify(nodeScrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = (await scrypt(password, salt, HASH_LENGTH)) as Buffer;

  return `${salt.toString("base64")}:${derivedKey.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  passwordHash: string | null,
): Promise<boolean> {
  if (!passwordHash) {
    return false;
  }

  const [salt, storedHash] = passwordHash.split(":");

  if (!salt || !storedHash) {
    return false;
  }

  const saltBuffer = Buffer.from(salt, "base64");
  const storedHashBuffer = Buffer.from(storedHash, "base64");
  const derivedKey = (await scrypt(password, saltBuffer, storedHashBuffer.length)) as Buffer;

  if (derivedKey.length !== storedHashBuffer.length) {
    return false;
  }

  return timingSafeEqual(storedHashBuffer, derivedKey);
}

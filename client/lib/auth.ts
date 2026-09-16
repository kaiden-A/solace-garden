import crypto from "node:crypto";
import { cookies } from "next/headers";
import { findUserById } from "./store";
import type { PublicUser } from "./types";

export const SESSION_COOKIE = "solace_session";
const MAX_AGE = 60 * 60 * 24 * 30;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export async function getSessionUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const user = findUserById(id);
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email };
}

export async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

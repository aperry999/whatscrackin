import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';

export type Admin = { email: string; role: 'owner' | 'editor' };

const COOKIE = 'wc_admin';
const SESSION_DAYS = 30;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters');
  return new TextEncoder().encode(s);
}

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export async function createLoginToken(email: string) {
  const token = randomBytes(32).toString('base64url');
  await db()`delete from login_tokens where expires_at < now() - interval '1 day'`;
  await db()`insert into login_tokens (token_hash, email, expires_at)
    values (${hashToken(token)}, ${email}, now() + interval '20 minutes')`;
  return token;
}

// Marks the token used and returns the admin it belongs to, or null if it's expired, used or unknown.
export async function consumeLoginToken(token: string): Promise<Admin | null> {
  const rows = await db()<{ email: string }[]>`
    update login_tokens set used_at = now()
    where token_hash = ${hashToken(token)} and used_at is null and expires_at > now()
    returning email`;
  if (!rows.length) return null;
  const [admin] = await db()<Admin[]>`select email, role from admins where email = ${rows[0].email}`;
  return admin ?? null;
}

export async function startSession(email: string) {
  const jwt = await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

// The signed-in admin, checked against the admins table every time so removed people lose access right away.
export async function getAdmin(): Promise<Admin | null> {
  const jwt = (await cookies()).get(COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secret());
    const email = typeof payload.email === 'string' ? payload.email : '';
    if (!email) return null;
    const [admin] = await db()<Admin[]>`select email, role from admins where email = ${email}`;
    return admin ?? null;
  } catch {
    return null;
  }
}

export function siteUrl() {
  return (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

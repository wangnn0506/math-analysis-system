import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getParentAccountById, getStudent } from "@/lib/store";
import type { ParentAccount, Student } from "@/lib/types";

const COOKIE_NAME = "shiqi_parent_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const SESSION_SECRET =
  process.env.PARENT_AUTH_SECRET || "local-development-parent-secret-change-me";

function signature(accountId: string, issuedAt: string) {
  return createHmac("sha256", SESSION_SECRET)
    .update(accountId + "." + issuedAt)
    .digest("base64url");
}

export function createParentSessionValue(accountId: string) {
  const issuedAt = String(Date.now());
  return accountId + "." + issuedAt + "." + signature(accountId, issuedAt);
}

function verifyParentSessionValue(value: string) {
  const [accountId, issuedAt, providedSignature] = value.split(".");
  if (!accountId || !issuedAt || !providedSignature) return null;
  const issuedAtNumber = Number(issuedAt);
  if (!Number.isFinite(issuedAtNumber)) return null;
  if (Date.now() - issuedAtNumber > SESSION_MAX_AGE * 1000) return null;
  const expected = signature(accountId, issuedAt);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(providedSignature);
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return null;
  }
  return accountId;
}

export async function setParentSession(accountId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createParentSessionValue(accountId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function clearParentSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getParentSession(): Promise<{
  account: ParentAccount;
  student: Student;
} | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const accountId = verifyParentSessionValue(raw);
  if (!accountId) return null;
  const account = await getParentAccountById(accountId);
  if (!account) return null;
  const student = await getStudent(account.studentId);
  if (!student) return null;
  return { account, student };
}

export async function requireParentSession(options?: { allowPasswordChange?: boolean }) {
  const session = await getParentSession();
  if (!session) redirect("/parent/login");
  if (session.account.mustChangePassword && !options?.allowPasswordChange) {
    redirect("/parent/password?first=1");
  }
  return session;
}

export { COOKIE_NAME, SESSION_MAX_AGE };

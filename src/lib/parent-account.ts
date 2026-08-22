import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { pinyin } from "pinyin-pro";

export const DEFAULT_PARENT_PASSWORD = "123456";

export function buildParentUsername(name: string, studentNo: string) {
  const romanized = pinyin(name, {
    toneType: "none",
    type: "array",
  })
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const safeName = romanized || "student";
  const safeStudentNo = studentNo.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return safeName + (safeStudentNo || "0000");
}

export function createPasswordHash(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

// Used only while upgrading an old JSON file before its first write. New
// accounts receive a fresh random salt; accounts using this credential are
// forced to change the default password after login.
export const DEFAULT_PARENT_CREDENTIALS = createPasswordHash(
  DEFAULT_PARENT_PASSWORD,
  "legacy-parent-default-salt",
);

export function verifyPassword(password: string, salt: string, expectedHash: string) {
  const actual = createPasswordHash(password, salt).hash;
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expectedHash, "hex");
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function validateParentPassword(password: string) {
  if (password.length < 6 || password.length > 128) {
    throw new Error("密码长度应为 6–128 位");
  }
}

export function validateParentPhone(phone: string) {
  if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
    throw new Error("请输入正确的 11 位手机号");
  }
}

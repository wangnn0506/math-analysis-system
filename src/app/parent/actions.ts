"use server";

import { redirect } from "next/navigation";
import {
  bindParentPhone,
  changeParentPassword,
  getParentAccountByUsername,
  recoverParentPassword,
  touchParentLogin,
} from "@/lib/store";
import {
  clearParentSession,
  getParentSession,
  setParentSession,
} from "@/lib/parent-auth";
import {
  DEFAULT_PARENT_PASSWORD,
  validateParentPassword,
  validateParentPhone,
  verifyPassword,
} from "@/lib/parent-account";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function redirectWithError(path: string, message: string) {
  redirect(path + "?error=" + encodeURIComponent(message));
}

export async function loginParentAction(formData: FormData) {
  const username = value(formData, "username").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) redirectWithError("/parent/login", "请输入账号和密码");
  const account = await getParentAccountByUsername(username);
  if (!account || !verifyPassword(password, account.passwordSalt, account.passwordHash)) {
    redirectWithError("/parent/login", "账号或密码错误");
  }
  if (!account) return;
  await setParentSession(account.id);
  await touchParentLogin(account.id);
  if (account.mustChangePassword || password === DEFAULT_PARENT_PASSWORD) {
    redirect("/parent/password?first=1");
  }
  redirect("/parent");
}

export async function changeParentPasswordAction(formData: FormData) {
  const session = await getParentSession();
  if (!session) redirect("/parent/login");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  try {
    validateParentPassword(password);
  } catch (error) {
    redirectWithError("/parent/password", error instanceof Error ? error.message : "密码无效");
  }
  if (password !== confirmPassword) redirectWithError("/parent/password", "两次输入的密码不一致");
  await changeParentPassword(session.account.id, password);
  redirect("/parent?success=" + encodeURIComponent("密码已修改"));
}

export async function bindParentPhoneAction(formData: FormData) {
  const session = await getParentSession();
  if (!session) redirect("/parent/login");
  const phone = value(formData, "phone");
  if (!phone) redirectWithError("/parent/profile", "请输入手机号");
  try {
    validateParentPhone(phone);
  } catch (error) {
    redirectWithError("/parent/profile", error instanceof Error ? error.message : "手机号无效");
  }
  await bindParentPhone(session.account.id, phone);
  redirect("/parent/profile?success=" + encodeURIComponent("手机号已绑定"));
}

export async function recoverParentPasswordAction(formData: FormData) {
  const username = value(formData, "username");
  const phone = value(formData, "phone");
  if (!username || !phone) redirectWithError("/parent/recover", "请输入账号和绑定手机号");
  try {
    await recoverParentPassword(username, phone);
  } catch (error) {
    redirectWithError("/parent/recover", error instanceof Error ? error.message : "找回密码失败");
  }
  redirect(
    "/parent/login?success=" +
      encodeURIComponent("密码已重置为 123456，请登录后立即修改"),
  );
}

export async function logoutParentAction() {
  await clearParentSession();
  redirect("/parent/login?success=" + encodeURIComponent("已安全退出"));
}

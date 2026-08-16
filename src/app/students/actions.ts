"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createStudent,
  deleteStudent,
  updateStudent,
} from "@/lib/store";

function requiredText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) throw new Error("请填写" + name);
  return value;
}

function studentRedirect(type: "success" | "error", message: string) {
  redirect("/students?" + type + "=" + encodeURIComponent(message));
}

export async function createStudentAction(formData: FormData) {
  try {
    await createStudent({
      studentNo: requiredText(formData, "studentNo"),
      name: requiredText(formData, "name"),
      className: String(formData.get("className") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
  } catch (error) {
    studentRedirect(
      "error",
      error instanceof Error ? error.message : "添加学生失败",
    );
  }
  revalidatePath("/");
  revalidatePath("/students");
  studentRedirect("success", "学生已添加");
}

export async function updateStudentAction(formData: FormData) {
  try {
    await updateStudent(requiredText(formData, "id"), {
      studentNo: requiredText(formData, "studentNo"),
      name: requiredText(formData, "name"),
      className: String(formData.get("className") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    });
  } catch (error) {
    studentRedirect(
      "error",
      error instanceof Error ? error.message : "保存学生失败",
    );
  }
  revalidatePath("/students");
  studentRedirect("success", "学生信息已保存");
}

export async function deleteStudentAction(formData: FormData) {
  try {
    await deleteStudent(requiredText(formData, "id"));
  } catch (error) {
    studentRedirect(
      "error",
      error instanceof Error ? error.message : "删除学生失败",
    );
  }
  revalidatePath("/");
  revalidatePath("/students");
  studentRedirect("success", "学生已删除");
}

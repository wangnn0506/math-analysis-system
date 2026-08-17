"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClass, updateClass } from "@/lib/store";

function requiredText(formData: FormData, name: string, label = "班级名称") {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) throw new Error("请填写" + label);
  return value;
}

function classRedirect(type: "success" | "error", message: string) {
  redirect("/classes?" + type + "=" + encodeURIComponent(message));
}

export async function createClassAction(formData: FormData) {
  try {
    const grade = requiredText(formData, "grade", "年级");
    const classNoText = requiredText(formData, "classNo", "班级");
    if (!["高一", "高二", "高三"].includes(grade)) {
      throw new Error("请选择正确的年级");
    }
    if (!/^([1-9]|1[0-9]|2[0-5])$/.test(classNoText)) {
      throw new Error("班级请输入 1 到 25 的数字");
    }
    await createClass({ name: `${grade}（${classNoText}）班` });
  } catch (error) {
    classRedirect("error", error instanceof Error ? error.message : "创建班级失败");
  }
  revalidatePath("/");
  revalidatePath("/classes");
  revalidatePath("/students");
  classRedirect("success", "班级已创建");
}

export async function updateClassAction(formData: FormData) {
  try {
    await updateClass(requiredText(formData, "id"), {
      name: requiredText(formData, "name"),
    });
  } catch (error) {
    classRedirect("error", error instanceof Error ? error.message : "保存班级失败");
  }
  revalidatePath("/");
  revalidatePath("/classes");
  revalidatePath("/students");
  classRedirect("success", "班级信息已保存");
}

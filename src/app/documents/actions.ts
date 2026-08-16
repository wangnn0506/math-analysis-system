"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addQuestion,
  deleteDocument,
  deleteQuestion,
  updateQuestion,
} from "@/lib/store";

function requiredText(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) throw new Error("请填写完整信息");
  return value;
}

function documentRedirect(
  path: string,
  type: "success" | "error",
  message: string,
) {
  redirect(path + "?" + type + "=" + encodeURIComponent(message));
}

export async function addQuestionAction(formData: FormData) {
  const documentId = requiredText(formData, "documentId");
  try {
    await addQuestion(documentId, {
      number: requiredText(formData, "number"),
      content: requiredText(formData, "content"),
    });
  } catch (error) {
    documentRedirect(
      "/documents/" + documentId,
      "error",
      error instanceof Error ? error.message : "添加题目失败",
    );
  }
  revalidatePath("/documents/" + documentId);
  documentRedirect("/documents/" + documentId, "success", "题目已添加");
}

export async function updateQuestionAction(formData: FormData) {
  const documentId = requiredText(formData, "documentId");
  try {
    await updateQuestion(requiredText(formData, "id"), {
      number: requiredText(formData, "number"),
      content: requiredText(formData, "content"),
    });
  } catch (error) {
    documentRedirect(
      "/documents/" + documentId,
      "error",
      error instanceof Error ? error.message : "保存题目失败",
    );
  }
  revalidatePath("/documents/" + documentId);
  documentRedirect("/documents/" + documentId, "success", "题目已保存");
}

export async function deleteQuestionAction(formData: FormData) {
  const documentId = requiredText(formData, "documentId");
  await deleteQuestion(requiredText(formData, "id"));
  revalidatePath("/");
  revalidatePath("/documents");
  revalidatePath("/documents/" + documentId);
  documentRedirect("/documents/" + documentId, "success", "题目已删除");
}

export async function deleteDocumentAction(formData: FormData) {
  try {
    await deleteDocument(requiredText(formData, "id"));
  } catch (error) {
    documentRedirect(
      "/documents",
      "error",
      error instanceof Error ? error.message : "删除试卷失败",
    );
  }
  revalidatePath("/");
  revalidatePath("/documents");
  documentRedirect("/documents", "success", "试卷已删除");
}

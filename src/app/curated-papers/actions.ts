"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCuratedPaper } from "@/lib/store";

function text(formData: FormData, name: string) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) throw new Error("请填写" + name);
  return value;
}

export async function createCuratedPaperAction(formData: FormData) {
  try {
    await createCuratedPaper({
      title: text(formData, "title"),
      subject: text(formData, "subject"),
      grade: text(formData, "grade"),
      description: String(formData.get("description") ?? ""),
      documentId: text(formData, "documentId"),
      published: true,
    });
  } catch (error) {
    redirect(
      "/curated-papers?error=" +
        encodeURIComponent(error instanceof Error ? error.message : "发布精选试卷失败"),
    );
  }
  revalidatePath("/curated-papers");
  revalidatePath("/parent/papers");
  redirect("/curated-papers?success=" + encodeURIComponent("精选试卷已发布"));
}

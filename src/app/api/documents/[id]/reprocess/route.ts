import { readFile } from "node:fs/promises";
import { locateImageQuestions } from "@/lib/documents/image-questions";
import { getDocumentWithQuestions, replaceImageQuestions } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const data = await getDocumentWithQuestions(id);
    if (!data) return Response.json({ error: "试卷不存在" }, { status: 404 });
    if (data.document.processingMode !== "page-images" || !data.document.pages?.length) {
      return Response.json({ error: "这份试卷不能重新识别题号" }, { status: 400 });
    }

    const pages = await Promise.all(
      data.document.pages.map(async (page) => ({
        buffer: await readFile(page.imagePath),
        width: page.width,
        height: page.height,
      })),
    );
    const located = await locateImageQuestions(pages);
    const baseWarnings = data.document.extractionWarnings.filter(
      (warning) =>
        !warning.startsWith("题号可能有遗漏") &&
        !warning.startsWith("检测到图片型试卷"),
    );
    const questions = await replaceImageQuestions(
      id,
      located.questions,
      [...baseWarnings, ...located.warnings],
    );
    return Response.json({ questions, warnings: located.warnings });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "重新识别失败" },
      { status: 400 },
    );
  }
}

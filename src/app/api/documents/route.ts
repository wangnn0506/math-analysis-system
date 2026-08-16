import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  extractDocumentText,
  extractPdfPageImages,
} from "@/lib/documents/extract";
import { locateImageQuestions } from "@/lib/documents/image-questions";
import { splitQuestions } from "@/lib/documents/split";
import { createDocument, uploadDirectory } from "@/lib/store";
import type { DocumentPage, Question } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const allowedExtensions = new Set([".pdf", ".docx"]);

function redirectWithMessage(
  request: Request,
  type: "success" | "error",
  message: string,
  pathName = "/documents",
) {
  const url = new URL(pathName, request.url);
  url.searchParams.set(type, message);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const storedPaths: string[] = [];
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("请选择试卷文档");
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("文件不能超过 500 MB");
    }

    const extension = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      throw new Error("只支持 PDF 或 DOCX 文档");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await mkdir(uploadDirectory, { recursive: true });
    const uploadId = randomUUID();
    const storedPath = path.join(uploadDirectory, uploadId + extension);
    await writeFile(storedPath, buffer);
    storedPaths.push(storedPath);

    const extraction = await extractDocumentText(buffer, extension);
    let questions: Array<
      Pick<Question, "number" | "content" | "anchor" | "cropRegions">
    >;
    let pages: DocumentPage[] = [];
    let processingMode: "text" | "page-images" = "text";
    let warnings = [...extraction.warnings];

    if (extraction.kind === "page-images") {
      const located = await locateImageQuestions(extraction.pages);
      questions = located.questions;
      warnings = [...warnings, ...located.warnings];
      processingMode = "page-images";
      pages = await Promise.all(
        extraction.pages.map(async (page, index) => {
          const imagePath = path.join(
            uploadDirectory,
            uploadId + "-page-" + (index + 1) + ".png",
          );
          await writeFile(imagePath, page.buffer);
          storedPaths.push(imagePath);
          return { imagePath, width: page.width, height: page.height };
        }),
      );
    } else {
      const split = splitQuestions(extraction.text);
      if (
        extension === ".pdf" &&
        split.questions.length === 1 &&
        split.questions[0]?.number === "全文"
      ) {
        // Some PDFs contain a text layer that has no usable question headings.
        // Retry those files as rendered page images instead of saving one
        // unusable “全文” question.
        const pageImages = await extractPdfPageImages(buffer);
        const located = await locateImageQuestions(pageImages);
        questions = located.questions;
        warnings = [...warnings, ...located.warnings];
        processingMode = "page-images";
        pages = await Promise.all(
          pageImages.map(async (page, index) => {
            const imagePath = path.join(
              uploadDirectory,
              uploadId + "-page-" + (index + 1) + ".png",
            );
            await writeFile(imagePath, page.buffer);
            storedPaths.push(imagePath);
            return { imagePath, width: page.width, height: page.height };
          }),
        );
      } else {
        questions = split.questions;
        warnings = [...warnings, ...split.warnings];
      }
    }

    const providedTitle = String(formData.get("title") ?? "").trim();
    const title = providedTitle || path.basename(file.name, extension);
    const document = await createDocument({
      title,
      originalFilename: file.name,
      mimeType: file.type || "application/octet-stream",
      filePath: storedPath,
      processingMode,
      pages,
      extractionWarnings: warnings,
      questions,
    });

    return redirectWithMessage(
      request,
      "success",
      (processingMode === "page-images" ? "已定位 " : "已识别 ") +
        questions.length +
        " 道题，请核对结果",
      "/documents/" + document.id,
    );
  } catch (error) {
    await Promise.all(storedPaths.map((storedPath) => unlink(storedPath).catch(() => undefined)));
    return redirectWithMessage(
      request,
      "error",
      error instanceof Error ? error.message : "文档处理失败",
    );
  }
}

import mammoth from "mammoth";
import JSZip from "jszip";
import { PNG } from "pngjs";

export type ExtractedPageImage = {
  buffer: Buffer;
  width: number;
  height: number;
};

export type DocumentExtraction =
  | { kind: "text"; text: string; warnings: string[] }
  | { kind: "page-images"; pages: ExtractedPageImage[]; warnings: string[] };

type PositionedText = {
  str: string;
  transform: number[];
  width?: number;
};

function joinLine(items: PositionedText[]) {
  const sorted = [...items].sort((a, b) => a.transform[4] - b.transform[4]);
  let result = "";
  let previousEnd = 0;

  for (const item of sorted) {
    const x = item.transform[4] ?? 0;
    const needsSpace =
      result.length > 0 &&
      x - previousEnd > 4 &&
      /[A-Za-z0-9)]$/.test(result) &&
      /^[A-Za-z0-9(]/.test(item.str);
    result += (needsSpace ? " " : "") + item.str;
    previousEnd = x + (item.width ?? item.str.length * 5);
  }

  return result.trim();
}

async function extractPdf(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  try {
    if (pdf.numPages > 300) {
      throw new Error("PDF 页数不能超过 300 页");
    }
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const textItems = content.items
        .filter(
          (item): item is typeof item & PositionedText =>
            "str" in item &&
            "transform" in item &&
            typeof item.str === "string" &&
            item.str.trim().length > 0,
        )
        .map((item) => ({
          str: item.str,
          transform: item.transform,
          width: "width" in item ? item.width : undefined,
        }));

      const lines: Array<{ y: number; items: PositionedText[] }> = [];
      for (const item of textItems) {
        const y = item.transform[5] ?? 0;
        const line = lines.find((candidate) => Math.abs(candidate.y - y) < 2.5);
        if (line) {
          line.items.push(item);
        } else {
          lines.push({ y, items: [item] });
        }
      }
      lines.sort((a, b) => b.y - a.y);
      const pageText = lines.map((line) => joinLine(line.items)).join("\n");
      pages.push("[第 " + pageNumber + " 页]\n" + pageText);
    }

    const text = pages.join("\n\n");
    if (text.length > 2_000_000) {
      throw new Error("PDF 可提取文字过多，请拆分后上传");
    }
    if (!text.replace(/\[第 \d+ 页\]/g, "").trim()) {
      // Scanned PDFs have no text layer. Render each page and send the original
      // pixels through the same question-marker OCR path used by image DOCX.
      return {
        kind: "page-images" as const,
        pages: await renderPdfPages(pdf),
        warnings: [] as string[],
      };
    }
    return { kind: "text" as const, text, warnings: [] as string[] };
  } finally {
    await pdf.destroy();
  }
}

async function renderPdfPages(
  pdf: Awaited<
    ReturnType<(typeof import("pdfjs-dist/legacy/build/pdf.mjs"))["getDocument"]>["promise"]
  >,
) {
  const { createCanvas } = await import("@napi-rs/canvas");
  const pages: ExtractedPageImage[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(
      2,
      2400 / Math.max(baseViewport.width, baseViewport.height),
    );
    const viewport = page.getViewport({ scale: Math.max(1, scale) });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");

    try {
      await page.render({
        canvasContext: context as unknown as Parameters<typeof page.render>[0]["canvasContext"],
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport,
      }).promise;
      pages.push({
        buffer: canvas.toBuffer("image/png"),
        width,
        height,
      });
    } finally {
      page.cleanup();
    }
  }

  return pages;
}

export async function extractPdfPageImages(buffer: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  try {
    if (pdf.numPages > 300) {
      throw new Error("PDF 页数不能超过 300 页");
    }
    return await renderPdfPages(pdf);
  } finally {
    await pdf.destroy();
  }
}

function xmlAttribute(tag: string, name: string) {
  const match = tag.match(new RegExp(name + '="([^"]+)"'));
  return match?.[1] ?? "";
}

async function extractDocxPageImages(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  const relationshipsXml = await zip
    .file("word/_rels/document.xml.rels")
    ?.async("string");
  if (!documentXml || !relationshipsXml) return [];

  const relationships = new Map<string, string>();
  for (const match of relationshipsXml.matchAll(/<Relationship\b[^>]*\/?\s*>/g)) {
    const tag = match[0];
    const id = xmlAttribute(tag, "Id");
    const target = xmlAttribute(tag, "Target");
    if (id && target) relationships.set(id, target.replace(/^\.\//, ""));
  }

  const pageImages: ExtractedPageImage[] = [];
  const seen = new Set<string>();
  for (const match of documentXml.matchAll(/<a:blip\b[^>]*r:embed="([^"]+)"[^>]*>/g)) {
    const target = relationships.get(match[1]);
    if (!target || seen.has(target)) continue;
    seen.add(target);
    const normalizedTarget = target.replace(/\\/g, "/").replace(/^\.\.\//, "");
    const entry = zip.file("word/" + normalizedTarget);
    if (!entry || !/\.png$/i.test(normalizedTarget)) continue;
    const image = await entry.async("nodebuffer");
    try {
      const decoded = PNG.sync.read(image, { skipRescale: true });
      const ratio = decoded.width / decoded.height;
      if (
        decoded.width >= 800 &&
        decoded.height >= 1000 &&
        ratio >= 0.55 &&
        ratio <= 0.9
      ) {
        pageImages.push({
          buffer: image,
          width: decoded.width,
          height: decoded.height,
        });
      }
    } catch {
      // Ignore non-standard or damaged embedded PNG files and use text extraction.
    }
  }
  return pageImages;
}

async function extractDocx(buffer: Buffer) {
  const [result, pageImages] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    extractDocxPageImages(buffer),
  ]);
  const warnings = result.messages.map((message) => message.message);
  if (pageImages.length > 0 && !result.value.trim()) {
    return {
      kind: "page-images" as const,
      pages: pageImages,
      warnings,
    };
  }
  if (!result.value.trim()) {
    throw new Error("DOCX 中没有可提取文字，也没有检测到可用的整页试卷图片");
  }
  if (result.value.length > 2_000_000) {
    throw new Error("DOCX 文字内容过多，请拆分后上传");
  }
  return { kind: "text" as const, text: result.value, warnings };
}

export async function extractDocumentText(
  buffer: Buffer,
  extension: string,
): Promise<DocumentExtraction> {
  if (extension === ".pdf") return extractPdf(buffer);
  if (extension === ".docx") return extractDocx(buffer);
  throw new Error("只支持 PDF 或 DOCX 文档");
}

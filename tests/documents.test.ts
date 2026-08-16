import {
  Document,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { PDFDocument } from "pdf-lib";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { extractDocumentText } from "@/lib/documents/extract";
import {
  cropPng,
  numberAtLineStart,
} from "@/lib/documents/image-questions";
import { generateWrongBookDocument } from "@/lib/documents/generate";
import { splitQuestions } from "@/lib/documents/split";
import { buildWrongBookTitle } from "@/lib/text";

describe("document pipeline", () => {
  it("extracts and splits a DOCX file", async () => {
    const source = new Document({
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun("1. 集合题正文")] }),
            new Paragraph({ children: [new TextRun("2. 函数题正文")] }),
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(source);
    const extraction = await extractDocumentText(buffer, ".docx");
    expect(extraction.kind).toBe("text");
    if (extraction.kind !== "text") throw new Error("expected text extraction");
    const result = splitQuestions(extraction.text);

    expect(result.questions.map((question) => question.number)).toEqual([
      "1",
      "2",
    ]);
  });

  it("detects a page-image DOCX without converting its math content to text", async () => {
    const image = new PNG({ width: 1000, height: 1400 });
    image.data.fill(255);
    const imageBuffer = PNG.sync.write(image);
    const source = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageBuffer,
                  type: "png",
                  transformation: { width: 500, height: 700 },
                }),
              ],
            }),
          ],
        },
      ],
    });

    const extraction = await extractDocumentText(
      await Packer.toBuffer(source),
      ".docx",
    );
    expect(extraction.kind).toBe("page-images");
    if (extraction.kind !== "page-images") throw new Error("expected page images");
    expect(extraction.pages).toHaveLength(1);
    expect(extraction.pages[0]).toMatchObject({ width: 1000, height: 1400 });

    const crop = cropPng(extraction.pages[0].buffer, {
      pageIndex: 0,
      x: 100,
      y: 200,
      width: 600,
      height: 300,
    });
    expect(crop).toMatchObject({ width: 600, height: 300 });
  });

  it("recovers common OCR confusions in question labels", () => {
    expect(numberAtLineStart("1L. 设函数 f(x)")).toBe("11");
    expect(numberAtLineStart("第 l2 题 求导数")).toBe("12");
    expect(numberAtLineStart("15S. 如图所示")).toBe("15");
    expect(numberAtLineStart("(ii) 求证")).toBeNull();
  });

  it("renders a scanned PDF into page images when no text layer exists", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([300, 420]);
    const extraction = await extractDocumentText(
      Buffer.from(await pdf.save()),
      ".pdf",
    );

    expect(extraction.kind).toBe("page-images");
    if (extraction.kind !== "page-images") throw new Error("expected page images");
    expect(extraction.pages).toHaveLength(1);
    expect(extraction.pages[0].width).toBeGreaterThan(500);
    expect(extraction.pages[0].height).toBeGreaterThan(700);
    expect(extraction.pages[0].buffer.subarray(0, 8).toString("hex")).toBe(
      "89504e470d0a1a0a",
    );
  });

  it("builds a wrong-book title from the paper and student identity", () => {
    expect(
      buildWrongBookTitle({
        documentTitle: "概率统计",
        studentName: "张三",
        className: "高二（1）班",
        studentNo: "001",
      }),
    ).toBe("概率统计 · 张三 · 高二（1）班 · 001");
  });

  it("generates a valid Word package for selected wrong questions", async () => {
    const buffer = await generateWrongBookDocument({
      title: "张三数学错题集",
      student: {
        id: "student-1",
        studentNo: "001",
        name: "张三",
        className: "高二（1）班",
        notes: "",
        createdAt: "2026-08-16T00:00:00.000Z",
        updatedAt: "2026-08-16T00:00:00.000Z",
      },
      sourceDocument: {
        id: "document-1",
        title: "函数单元测试",
        originalFilename: "函数测试.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filePath: "",
        status: "READY",
        questionCount: 1,
        extractionWarnings: [],
        createdAt: "2026-08-16T00:00:00.000Z",
        updatedAt: "2026-08-16T00:00:00.000Z",
      },
      questions: [
        {
          id: "question-1",
          documentId: "document-1",
          number: "2",
          content: "已知函数 f(x)=x²，求其单调区间。",
          order: 1,
          createdAt: "2026-08-16T00:00:00.000Z",
          updatedAt: "2026-08-16T00:00:00.000Z",
        },
      ],
    });

    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    expect(buffer.length).toBeGreaterThan(5_000);
  });
});

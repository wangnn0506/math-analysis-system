import { PDFDocument } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { extractDocumentText } from "@/lib/documents/extract";
import { locateImageQuestions } from "@/lib/documents/image-questions";

describe("PDF OCR regression", () => {
  it("locates numbers from a rendered PDF page", async () => {
    const canvas = createCanvas(1200, 1600);
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, 1200, 1600);
    context.fillStyle = "black";
    context.font = "64px Arial";
    context.fillText("1. Question one", 100, 220);
    context.fillText("2. Question two", 100, 620);

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([600, 800]);
    const image = await pdf.embedPng(canvas.toBuffer("image/png"));
    page.drawImage(image, { x: 0, y: 0, width: 600, height: 800 });
    const extraction = await extractDocumentText(
      Buffer.from(await pdf.save()),
      ".pdf",
    );
    expect(extraction.kind).toBe("page-images");
    if (extraction.kind !== "page-images") throw new Error("expected page images");
    const located = await locateImageQuestions(extraction.pages);
    expect(located.questions.map((question) => question.number)).toEqual(["1", "2"]);
  }, 30_000);
});

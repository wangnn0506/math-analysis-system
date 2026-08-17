import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";

const playwrightRoot = process.env.PLAYWRIGHT_MODULE;
const browserExecutable = process.env.BROWSER_EXECUTABLE;
if (!playwrightRoot || !browserExecutable) {
  throw new Error("PLAYWRIGHT_MODULE and BROWSER_EXECUTABLE are required");
}

const { chromium } = await import(
  pathToFileURL(path.join(playwrightRoot, "index.mjs")).href
);
const outputDirectory = path.resolve("test-results");
await mkdir(outputDirectory, { recursive: true });

const sourceDocxPath = path.join(outputDirectory, "sample-math-paper.docx");
const sourceDocx = new Document({
  sections: [
    {
      children: [
        new Paragraph({ children: [new TextRun("高中数学函数单元测试")] }),
        new Paragraph({ children: [new TextRun("一、选择题")] }),
        new Paragraph({
          children: [
            new TextRun("1. 已知集合 A={1,2,3}，则 A 的子集个数为（ ）"),
          ],
        }),
        new Paragraph({
          children: [new TextRun("A. 3    B. 6    C. 8    D. 9")],
        }),
        new Paragraph({
          children: [new TextRun("2、函数 f(x)=x²-2x+1 的最小值是（ ）")],
        }),
        new Paragraph({
          children: [new TextRun("A. -1    B. 0    C. 1    D. 2")],
        }),
        new Paragraph({ children: [new TextRun("二、解答题")] }),
        new Paragraph({
          children: [new TextRun("第3题 已知函数 f(x)=2ˣ。")],
        }),
        new Paragraph({ children: [new TextRun("（1）求 f(0)；")] }),
        new Paragraph({
          children: [new TextRun("（2）判断函数在实数集上的单调性。")],
        }),
      ],
    },
  ],
});
await writeFile(sourceDocxPath, await Packer.toBuffer(sourceDocx));

const sourcePdfPath = path.join(outputDirectory, "sample-math-paper.pdf");
const sourcePdf = await PDFDocument.create();
const pageForPdf = sourcePdf.addPage([612, 792]);
const font = await sourcePdf.embedFont(StandardFonts.Helvetica);
pageForPdf.drawText("High School Mathematics Test", {
  x: 72,
  y: 740,
  size: 16,
  font,
});
pageForPdf.drawText("1. Find the minimum value of f(x) = x^2 - 2x + 1.", {
  x: 72,
  y: 700,
  size: 11,
  font,
});
pageForPdf.drawText("2. Solve the equation 2x + 3 = 9.", {
  x: 72,
  y: 670,
  size: 11,
  font,
});
await writeFile(sourcePdfPath, await sourcePdf.save());

const browser = await chromium.launch({
  headless: true,
  executablePath: browserExecutable,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });

try {
  await page.goto("http://localhost:3000/classes");
  await page.locator(".class-create-form select[name=grade]").selectOption("高二");
  await page.locator(".class-create-form input[name=classNo]").fill("1");
  await page.locator(".class-create-form button[type=submit]").click();
  await page.waitForURL(/success=/);

  await page.goto("http://localhost:3000/students");
  await page.locator(".student-create-form input[name=studentNo]").fill("2026001");
  await page.locator(".student-create-form input[name=name]").fill("张三");
  await page.locator(".student-create-form select[name=classId]").selectOption({
    label: "高二（1）班",
  });
  await page.locator(".student-create-form button[type=submit]").click();
  await page.waitForURL(/success=/);
  await page.getByText("学生已添加").waitFor();
  await page.screenshot({
    path: path.join(outputDirectory, "students.png"),
    fullPage: true,
  });

  await page.goto("http://localhost:3000/documents");
  await page.locator(".upload-form input[name=title]").fill("函数单元测试");
  await page
    .locator(".upload-form input[type=file]")
    .setInputFiles(sourceDocxPath);
  await page.locator(".upload-form button[type=submit]").click();
  await page.waitForURL(/\/documents\/[^?]+\?success=/, { timeout: 20_000 });
  await page.getByText("已识别 3 道题").first().waitFor();
  await page.screenshot({
    path: path.join(outputDirectory, "document-preview.png"),
    fullPage: true,
  });

  await page.goto("http://localhost:3000/documents");
  await page.locator(".upload-form input[name=title]").fill("PDF题号测试");
  await page
    .locator(".upload-form input[type=file]")
    .setInputFiles(sourcePdfPath);
  await page.locator(".upload-form button[type=submit]").click();
  await page.waitForURL(/\/documents\/[^?]+\?success=/, { timeout: 20_000 });
  await page.getByText("已识别 2 道题").first().waitFor();

  await page.goto("http://localhost:3000/wrong-books");
  await page.locator("select[name=studentId]").selectOption({ index: 1 });
  await page
    .locator("select[name=documentId]")
    .selectOption({ label: "函数单元测试（3 题）" });
  await page.locator("input[name=questionNumbers]").fill("1, 3");
  await page.screenshot({
    path: path.join(outputDirectory, "wrong-book-form.png"),
    fullPage: true,
  });
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "生成并下载 Word 文档" })
    .click();
  const download = await downloadPromise;
  await download.saveAs(path.join(outputDirectory, "张三函数错题练习.docx"));
  if (await download.failure()) {
    throw new Error("DOCX download failed: " + (await download.failure()));
  }

  console.log("E2E smoke test passed");
} finally {
  await browser.close();
}

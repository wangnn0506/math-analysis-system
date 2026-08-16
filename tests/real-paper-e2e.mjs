import path from "node:path";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const playwrightRoot = process.env.PLAYWRIGHT_MODULE;
const browserExecutable = process.env.BROWSER_EXECUTABLE;
const documentId = process.env.DOCUMENT_ID;
if (!playwrightRoot || !browserExecutable || !documentId) {
  throw new Error("PLAYWRIGHT_MODULE, BROWSER_EXECUTABLE and DOCUMENT_ID are required");
}

const { chromium } = await import(
  pathToFileURL(path.join(playwrightRoot, "index.mjs")).href
);
const outputDirectory = path.resolve("test-results", "real-paper-browser");
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: browserExecutable,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

try {
  await page.goto("http://localhost:3100/students");
  await page.locator(".student-create-form input[name=studentNo]").fill("REAL001");
  await page.locator(".student-create-form input[name=name]").fill("真实试卷测试学生");
  await page.locator(".student-create-form input[name=className]").fill("高三测试班");
  await page.locator(".student-create-form button[type=submit]").click();
  await page.waitForURL(/success=/);

  await page.goto(`http://localhost:3100/documents/${documentId}`);
  await page.locator(".paper-image-stage img").first().waitFor();
  const pageCount = await page.locator(".paper-image-stage img").count();
  const questionCount = await page.locator(".question-pick-button").count();
  if (pageCount !== 4 || questionCount !== 19) {
    throw new Error(`Expected 4 pages and 19 question buttons, got ${pageCount}/${questionCount}`);
  }
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".paper-image-stage img")].every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
  );
  await page.screenshot({
    path: path.join(outputDirectory, "full-paper-selection.png"),
    fullPage: true,
  });

  for (const number of ["1", "9", "18"]) {
    await page.getByRole("button", { name: `选择第 ${number} 题` }).click();
  }
  await page.locator("select[name=studentId]").selectOption({ index: 1 });
  await page.locator("input[name=title]").fill("真实试卷错题裁图验收");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "生成并下载错题 Word" }).click();
  const download = await downloadPromise;
  const outputPath = path.join(outputDirectory, "真实试卷错题裁图验收.docx");
  await download.saveAs(outputPath);
  const failure = await download.failure();
  if (failure) throw new Error("DOCX download failed: " + failure);
  console.log(JSON.stringify({ pageCount, questionCount, outputPath }));
} finally {
  await browser.close();
}

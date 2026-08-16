import { readFile } from "node:fs/promises";
import { getDocumentPage } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; page: string }> },
) {
  const { id, page } = await context.params;
  const pageIndex = Number(page) - 1;
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    return new Response("页面不存在", { status: 404 });
  }
  const data = await getDocumentPage(id, pageIndex);
  if (!data) return new Response("页面不存在", { status: 404 });

  try {
    const image = await readFile(data.page.imagePath);
    return new Response(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(image.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("页面文件不存在", { status: 404 });
  }
}

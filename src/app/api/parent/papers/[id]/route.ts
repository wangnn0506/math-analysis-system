import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getParentSession } from "@/lib/parent-auth";
import { getCuratedPaper } from "@/lib/store";
import { safeDownloadName } from "@/lib/text";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getParentSession();
    if (!session) return new NextResponse("请先登录", { status: 401 });
    const { id } = await context.params;
    const data = await getCuratedPaper(id);
    if (!data || !data.paper.published) {
      return new NextResponse("精选试卷不存在", { status: 404 });
    }
    const buffer = await readFile(data.document.filePath);
    const filename = safeDownloadName(data.document.originalFilename);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": data.document.mimeType || "application/octet-stream",
        "Content-Disposition":
          'attachment; filename="paper"; filename*=UTF-8\'\'' +
          encodeURIComponent(filename),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : "下载试卷失败", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

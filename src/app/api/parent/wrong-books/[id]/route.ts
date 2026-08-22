import { NextResponse } from "next/server";
import { generateWrongBookDocument } from "@/lib/documents/generate";
import { getWrongBookDownloadData } from "@/lib/store";
import { getParentSession } from "@/lib/parent-auth";
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
    const data = await getWrongBookDownloadData(id);
    if (!data || data.student.id !== session.student.id) {
      return new NextResponse("错题文档不存在", { status: 404 });
    }
    const buffer = await generateWrongBookDocument({
      title: data.wrongBook.title,
      student: data.student,
      sourceDocument: data.document,
      questions: data.questions,
    });
    const filename = safeDownloadName(data.wrongBook.title) + ".docx";
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition":
          'attachment; filename="wrong-book.docx"; filename*=UTF-8\'\'' +
          encodeURIComponent(filename),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : "下载失败", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

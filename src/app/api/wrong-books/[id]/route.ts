import { NextResponse } from "next/server";
import { generateWrongBookDocument } from "@/lib/documents/generate";
import { getWrongBookDownloadData } from "@/lib/store";
import { safeDownloadName } from "@/lib/text";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const data = await getWrongBookDownloadData(id);
  if (!data) {
    return new NextResponse("错题文档记录不存在", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const buffer = await generateWrongBookDocument({
    title: data.wrongBook.title,
    student: data.student,
    sourceDocument: data.document,
    questions: data.questions,
  });
  const filename = safeDownloadName(data.wrongBook.title) + ".docx";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition":
        'attachment; filename="wrong-book.docx"; filename*=UTF-8\'\'' +
        encodeURIComponent(filename),
      "Cache-Control": "no-store",
    },
  });
}

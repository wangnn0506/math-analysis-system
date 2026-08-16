import { buildImageQuestionsFromAnchors } from "@/lib/documents/image-questions";
import { getDocumentWithQuestions, replaceImageQuestions } from "@/lib/store";

export const runtime = "nodejs";

type SubmittedMarker = {
  number?: unknown;
  pageIndex?: unknown;
  x?: unknown;
  y?: unknown;
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const data = await getDocumentWithQuestions(id);
    if (!data) return Response.json({ error: "试卷不存在" }, { status: 404 });
    if (data.document.processingMode !== "page-images" || !data.document.pages?.length) {
      return Response.json({ error: "这份试卷不能使用图片题号校正" }, { status: 400 });
    }

    const body = (await request.json()) as { markers?: SubmittedMarker[] };
    if (!Array.isArray(body.markers)) {
      return Response.json({ error: "题号标记格式不正确" }, { status: 400 });
    }
    const anchors = body.markers.map((marker) => ({
      number: String(marker.number ?? "").trim(),
      pageIndex: Number(marker.pageIndex),
      x: Math.round(Number(marker.x)),
      y: Math.round(Number(marker.y)),
    }));
    if (
      anchors.some(
        (anchor) =>
          !Number.isInteger(anchor.pageIndex) ||
          !Number.isFinite(anchor.x) ||
          !Number.isFinite(anchor.y),
      )
    ) {
      return Response.json({ error: "题号标记位置不正确" }, { status: 400 });
    }

    const located = buildImageQuestionsFromAnchors(data.document.pages, anchors);
    const warnings = data.document.extractionWarnings.filter(
      (warning) =>
        !warning.startsWith("题号可能有遗漏") &&
        !warning.startsWith("检测到图片型试卷"),
    );
    const questions = await replaceImageQuestions(id, located, warnings);
    return Response.json({ questions });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "保存题号失败" },
      { status: 400 },
    );
  }
}

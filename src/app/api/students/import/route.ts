import { NextResponse } from "next/server";
import { importStudents } from "@/lib/store";

export const runtime = "nodejs";

type ImportRequest = {
  classId?: string;
  rows?: Array<{ rowNumber?: number; studentNo?: string; name?: string }>;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ImportRequest;
    const classId = String(payload.classId ?? "").trim();
    if (!classId) throw new Error("请选择导入班级");
    if (!Array.isArray(payload.rows)) throw new Error("没有可导入的数据");
    if (payload.rows.length > 5000) throw new Error("一次最多导入 5000 名学生");
    const rows = payload.rows.map((row, index) => ({
      rowNumber: Number.isFinite(row.rowNumber) ? Number(row.rowNumber) : index + 1,
      studentNo: String(row.studentNo ?? ""),
      name: String(row.name ?? ""),
    }));
    const result = await importStudents(classId, rows);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导入学生失败" },
      { status: 400 },
    );
  }
}

import path from "node:path";
import { NextResponse } from "next/server";
import { parseStudentWorkbook } from "@/lib/students/import";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const allowedExtensions = new Set([".xlsx", ".xls", ".csv"]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("请选择学生名单文件");
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("学生名单文件不能超过 20 MB");
    }
    const extension = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      throw new Error("仅支持 .xlsx、.xls 或 .csv 文件");
    }
    const preview = parseStudentWorkbook(Buffer.from(await file.arrayBuffer()), file.name);
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "读取学生名单失败" },
      { status: 400 },
    );
  }
}

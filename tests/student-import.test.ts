import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseStudentWorkbook } from "@/lib/students/import";

function workbookBuffer(rows: unknown[][], bookType: XLSX.BookType = "xlsx") {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "名单");
  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType }));
}

describe("student workbook import", () => {
  it("detects common Chinese headers and preserves row numbers", () => {
    const preview = parseStudentWorkbook(
      workbookBuffer([
        ["序号", "姓名", "学号", "班级"],
        [1, "张三", "2026001", "高二（1）班"],
        [2, "李四", "2026002", "高二（1）班"],
      ]),
      "名单.xlsx",
    );

    expect(preview.headerRowIndex).toBe(0);
    expect(preview.detectedNameColumn).toBe(1);
    expect(preview.detectedStudentNoColumn).toBe(2);
    expect(preview.rows[0]).toEqual({
      rowNumber: 2,
      cells: ["1", "张三", "2026001", "高二（1）班"],
    });
  });

  it("infers number and name columns when a roster has no header", () => {
    const preview = parseStudentWorkbook(
      workbookBuffer([
        ["2026001", "张三"],
        ["2026002", "李四"],
      ]),
      "无表头.csv",
    );

    expect(preview.headerRowIndex).toBeNull();
    expect(preview.detectedStudentNoColumn).toBe(0);
    expect(preview.detectedNameColumn).toBe(1);
    expect(preview.headers).toEqual(["第1列", "第2列"]);
  });

  it("accepts a partial header and leaves the remaining mapping adjustable", () => {
    const preview = parseStudentWorkbook(
      workbookBuffer([
        ["姓名", "班级", "备注"],
        ["张三", "高二（1）班", ""],
      ]),
      "部分表头.xlsx",
    );

    expect(preview.headerRowIndex).toBe(0);
    expect(preview.detectedNameColumn).toBe(0);
    expect(preview.detectedStudentNoColumn).toBe(1);
  });
});

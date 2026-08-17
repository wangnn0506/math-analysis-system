"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClassGroup } from "@/lib/types";
import type { StudentImportPreview } from "@/lib/students/import";

type Props = {
  classes: ClassGroup[];
  defaultClassId?: string;
};

type ImportResult = {
  imported: number;
  skipped: number;
  errors: Array<{ rowNumber: number; message: string }>;
};

export function StudentImport({ classes, defaultClassId }: Props) {
  const router = useRouter();
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);
  const [classId, setClassId] = useState(defaultClassId ?? "");
  const [nameColumn, setNameColumn] = useState("");
  const [studentNoColumn, setStudentNoColumn] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedNameColumn = nameColumn === "" ? null : Number(nameColumn);
  const selectedStudentNoColumn =
    studentNoColumn === "" ? null : Number(studentNoColumn);
  const canConfirm =
    Boolean(
      preview &&
        classId &&
        selectedNameColumn !== null &&
        selectedStudentNoColumn !== null &&
        selectedNameColumn !== selectedStudentNoColumn,
    );

  const mappedRows = useMemo(() => {
    if (!preview || selectedNameColumn === null || selectedStudentNoColumn === null) return [];
    return preview.rows.map((row) => ({
      rowNumber: row.rowNumber,
      name: row.cells[selectedNameColumn] ?? "",
      studentNo: row.cells[selectedStudentNoColumn] ?? "",
    }));
  }, [preview, selectedNameColumn, selectedStudentNoColumn]);

  async function previewFile(nextFile: File | null) {
    setPreview(null);
    setMessage("");
    setError("");
    if (!nextFile) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.set("file", nextFile);
      const response = await fetch("/api/students/import/preview", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as StudentImportPreview & { error?: string };
      if (!response.ok) throw new Error(payload.error || "读取名单失败");
      setPreview(payload);
      setNameColumn(
        payload.detectedNameColumn === null ? "" : String(payload.detectedNameColumn),
      );
      setStudentNoColumn(
        payload.detectedStudentNoColumn === null
          ? ""
          : String(payload.detectedStudentNoColumn),
      );
      setMessage(`已读取 ${payload.rows.length} 行，工作表：${payload.sheetName}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取名单失败");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!canConfirm) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, rows: mappedRows }),
      });
      const payload = (await response.json()) as Partial<ImportResult> & { error?: string };
      if (!response.ok) throw new Error(payload.error || "导入学生失败");
      const result = payload as ImportResult;
      const skippedMessage = result.skipped
        ? `，跳过 ${result.skipped} 行（重复或缺少信息）`
        : "";
      setMessage(`成功导入 ${result.imported} 名学生${skippedMessage}`);
      if (result.errors?.length) {
        setError(
          result.errors
            .slice(0, 8)
            .map((item) => `第 ${item.rowNumber} 行：${item.message}`)
            .join("；"),
        );
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导入学生失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel form-panel student-import-card" id="batch-import">
      <div className="section-heading">
        <div>
          <h2>Excel 批量导入</h2>
          <p>上传名单后先预览并确认列，所有行会归入所选班级。</p>
        </div>
      </div>
      <div className="student-import-controls">
        <label>
          <span>选择文件</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(event) => void previewFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <label>
          <span>导入班级 *</span>
          <select value={classId} onChange={(event) => setClassId(event.target.value)} required>
            <option value="">请选择班级</option>
            {classes.map((classGroup) => (
              <option key={classGroup.id} value={classGroup.id}>
                {classGroup.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {busy ? <p className="import-status">正在处理，请稍候…</p> : null}
      {message ? <p className="import-status success-text">{message}</p> : null}
      {error ? <p className="import-status error-text">{error}</p> : null}

      {preview ? (
        <div className="import-preview">
          <div className="import-mapping-grid">
            <label>
              <span>姓名列</span>
              <select value={nameColumn} onChange={(event) => setNameColumn(event.target.value)}>
                <option value="">请选择</option>
                {preview.headers.map((header, index) => (
                  <option key={`name-${index}`} value={index}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>学号列</span>
              <select
                value={studentNoColumn}
                onChange={(event) => setStudentNoColumn(event.target.value)}
              >
                <option value="">请选择</option>
                {preview.headers.map((header, index) => (
                  <option key={`no-${index}`} value={index}>
                    {header}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button button-primary button-small"
              type="button"
              disabled={!canConfirm || busy}
              onClick={() => void confirmImport()}
            >
              确认导入
            </button>
          </div>
          <div className="import-preview-table-wrap">
            <table className="import-preview-table">
              <thead>
                <tr>
                  <th>行号</th>
                  {preview.headers.map((header, index) => (
                    <th key={`${header}-${index}`}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 10).map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    {row.cells.map((cell, index) => <td key={`${row.rowNumber}-${index}`}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <small className="import-hint">
            {preview.headerRowIndex === null
              ? "未检测到表头，已根据内容推测姓名列和学号列；请在上方核对。"
              : "已自动识别表头；如果列顺序不同，可在上方手动调整。"}
          </small>
        </div>
      ) : null}
    </section>
  );
}

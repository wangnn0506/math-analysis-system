import * as XLSX from "xlsx";

export type StudentImportPreview = {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: Array<{ rowNumber: number; cells: string[] }>;
  headerRowIndex: number | null;
  detectedNameColumn: number | null;
  detectedStudentNoColumn: number | null;
};

const MAX_PREVIEW_ROWS = 5000;
const HEADER_SCAN_ROWS = 12;

const nameAliases = [
  "姓名",
  "学生姓名",
  "学生",
  "学员姓名",
  "name",
  "studentname",
];
const studentNoAliases = [
  "学号",
  "学籍号",
  "考号",
  "学生编号",
  "学生号",
  "编号",
  "studentno",
  "studentid",
  "studentnumber",
  "id",
  "no",
];

function text(value: unknown) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .trim();
}

function normalized(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s_\-—():：/\\.。]/g, "")
    .replace(/[（(].*?[）)]/g, "");
}

function matchesAlias(value: string, aliases: string[]) {
  const candidate = normalized(value);
  return aliases.some((alias) => {
    const target = normalized(alias);
    return candidate === target || candidate.includes(target);
  });
}

function columnForAliases(row: string[], aliases: string[]) {
  const index = row.findIndex((cell) => matchesAlias(cell, aliases));
  return index >= 0 ? index : null;
}

function numericRatio(rows: string[][], column: number) {
  const values = rows
    .map((row) => row[column] ?? "")
    .filter(Boolean)
    .slice(0, 30);
  if (values.length === 0) return 0;
  return values.filter((value) => /^[0-9０-９][0-9０-９\- ]*$/.test(value)).length / values.length;
}

function inferColumns(rows: string[][]) {
  const columnCount = Math.max(...rows.map((row) => row.length), 0);
  if (columnCount < 2) return { studentNoColumn: null, nameColumn: null };
  const ratios = Array.from({ length: columnCount }, (_, column) =>
    numericRatio(rows, column),
  );
  const numericColumn = ratios.findIndex((ratio) => ratio >= 0.6);
  if (numericColumn >= 0) {
    const nameColumn = numericColumn === 0 ? 1 : 0;
    return { studentNoColumn: numericColumn, nameColumn };
  }
  // Most school rosters put student number before name. The teacher can
  // correct this in the preview when a workbook uses another order.
  return { studentNoColumn: 0, nameColumn: 1 };
}

function inferMissingHeaderColumns(
  header: string[],
  dataRows: string[][],
  current: { studentNoColumn: number | null; nameColumn: number | null },
) {
  const columnCount = header.length;
  let { studentNoColumn, nameColumn } = current;
  if (studentNoColumn === null) {
    const numericColumn = Array.from({ length: columnCount }, (_, column) => column)
      .filter((column) => column !== nameColumn)
      .sort((a, b) => numericRatio(dataRows, b) - numericRatio(dataRows, a))[0];
    studentNoColumn = numericColumn ?? null;
  }
  if (nameColumn === null) {
    const nameColumnCandidate = Array.from({ length: columnCount }, (_, column) => column)
      .filter((column) => column !== studentNoColumn)
      .sort((a, b) => numericRatio(dataRows, a) - numericRatio(dataRows, b))[0];
    nameColumn = nameColumnCandidate ?? null;
  }
  return { studentNoColumn, nameColumn };
}

export function parseStudentWorkbook(
  buffer: Buffer,
  fileName: string,
): StudentImportPreview {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", raw: false, cellDates: false });
  } catch {
    throw new Error("无法读取该文件，请确认它是有效的 Excel 或 CSV 文件");
  }
  let sheetName = "";
  let rows: string[][] = [];
  for (const candidate of workbook.SheetNames) {
    const sheet = workbook.Sheets[candidate];
    const sourceRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    });
    const candidateRows = sourceRows
      .map((row) => row.map(text))
      .filter((row) => row.some(Boolean));
    if (candidateRows.length > 0) {
      sheetName = candidate;
      rows = candidateRows;
      break;
    }
  }
  if (!sheetName) throw new Error("文件中没有可读取的工作表");
  if (rows.length === 0) throw new Error("文件中没有可读取的内容");
  if (rows.length > MAX_PREVIEW_ROWS + HEADER_SCAN_ROWS) {
    throw new Error("一次最多处理 5000 行学生数据");
  }

  let headerRowIndex: number | null = null;
  let detectedNameColumn: number | null = null;
  let detectedStudentNoColumn: number | null = null;
  for (let index = 0; index < Math.min(rows.length, HEADER_SCAN_ROWS); index += 1) {
    const row = rows[index];
    const nameColumn = columnForAliases(row, nameAliases);
    const studentNoColumn = columnForAliases(row, studentNoAliases);
    if (
      (nameColumn !== null || studentNoColumn !== null) &&
      row.filter(Boolean).length >= 2
    ) {
      headerRowIndex = index;
      detectedNameColumn = nameColumn;
      detectedStudentNoColumn = studentNoColumn;
      break;
    }
  }

  const dataRows = headerRowIndex === null ? rows : rows.slice(headerRowIndex + 1);
  const inferred =
    headerRowIndex === null
      ? inferColumns(dataRows)
      : inferMissingHeaderColumns(rows[headerRowIndex], dataRows, {
          studentNoColumn: detectedStudentNoColumn,
          nameColumn: detectedNameColumn,
        });
  if (detectedNameColumn === null) detectedNameColumn = inferred.nameColumn;
  if (detectedStudentNoColumn === null) detectedStudentNoColumn = inferred.studentNoColumn;

  const columnCount = Math.max(
    headerRowIndex === null ? 0 : rows[headerRowIndex].length,
    ...dataRows.map((row) => row.length),
  );
  const headers = Array.from({ length: columnCount }, (_, column) => {
    const header = headerRowIndex === null ? "" : rows[headerRowIndex][column];
    return header || `第${column + 1}列`;
  });
  const previewRows = dataRows.slice(0, MAX_PREVIEW_ROWS).map((row, index) => ({
    rowNumber:
      headerRowIndex === null
        ? index + 1
        : headerRowIndex + 2 + index,
    cells: Array.from({ length: columnCount }, (_, column) => row[column] ?? ""),
  }));

  return {
    fileName,
    sheetName,
    headers,
    rows: previewRows,
    headerRowIndex,
    detectedNameColumn,
    detectedStudentNoColumn,
  };
}

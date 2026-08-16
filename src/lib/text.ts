export function normalizeQuestionNumber(value: string) {
  return value
    .trim()
    .replace(/[０-９]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
    )
    .replace(/^第\s*/, "")
    .replace(/\s*题$/, "")
    .replace(/[.．、)）]+$/, "")
    .trim();
}

export function parseQuestionNumberInput(value: string) {
  const seen = new Set<string>();
  return value
    .split(/[\s,，、;；]+/)
    .map(normalizeQuestionNumber)
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

export function safeDownloadName(value: string) {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 150) || "错题集";
}

export function buildWrongBookTitle(input: {
  documentTitle: string;
  studentName: string;
  className?: string;
  studentNo: string;
}) {
  const title = [
    input.documentTitle,
    input.studentName,
    input.className,
    input.studentNo,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" · ");
  return title.slice(0, 150) || "错题集";
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

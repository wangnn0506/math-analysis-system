import { normalizeQuestionNumber } from "@/lib/text";

export type SplitQuestion = {
  number: string;
  content: string;
};

export type SplitResult = {
  questions: SplitQuestion[];
  warnings: string[];
};

const sectionHeadingPattern =
  /^(?:选择题|填空题|判断题|解答题|计算题|综合题|一、|二、|三、|四、|五、)/;
const standaloneSectionHeadingPattern =
  /^\s*[一二三四五六七八九十]+\s*[、.．]\s*(?:选择题|填空题|判断题|解答题|计算题|综合题)/;

function matchQuestionHeading(line: string) {
  const normalizedLine = line
    .replace(/[０-９]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
    )
    .trim();

  const patterns = [
    /^第\s*(\d{1,3})\s*题\s*[:：.．、-]?\s*(.*)$/,
    /^(\d{1,3})\s*[.．、)）]\s*(.*)$/,
  ];

  for (const pattern of patterns) {
    const match = normalizedLine.match(pattern);
    if (match && !sectionHeadingPattern.test(match[2]?.trim() ?? "")) {
      return {
        number: normalizeQuestionNumber(match[1]),
        remainder: match[2]?.trim() ?? "",
      };
    }
  }
  return null;
}

export function splitQuestions(text: string): SplitResult {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .split("\n");
  const warnings: string[] = [];
  const questions: SplitQuestion[] = [];
  const seenNumbers = new Map<string, number>();
  let current: { number: string; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const content = current.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    questions.push({
      number: current.number,
      content: content || "（未识别到题目正文，请教师补充）",
    });
  };

  for (const line of lines) {
    if (standaloneSectionHeadingPattern.test(line)) {
      continue;
    }
    const heading = matchQuestionHeading(line);
    if (!heading) {
      if (current) current.lines.push(line);
      continue;
    }

    flush();
    const duplicateIndex = (seenNumbers.get(heading.number) ?? 0) + 1;
    seenNumbers.set(heading.number, duplicateIndex);
    const number =
      duplicateIndex === 1
        ? heading.number
        : heading.number + "-" + duplicateIndex;
    if (duplicateIndex > 1) {
      warnings.push(
        "检测到重复题号 " +
          heading.number +
          "，已临时标记为 " +
          number +
          "，请在预览页确认。",
      );
    }
    current = {
      number,
      lines: heading.remainder ? [heading.remainder] : [],
    };
  }
  flush();

  if (questions.length === 0) {
    warnings.push(
      "未识别到标准题号，已将全文作为一个片段。请在预览页手动拆分。",
    );
    return {
      questions: [
        {
          number: "全文",
          content: text.trim() || "（文档无可识别内容）",
        },
      ],
      warnings,
    };
  }

  const firstNumeric = Number(questions[0].number);
  if (Number.isFinite(firstNumeric) && firstNumeric !== 1) {
    warnings.push(
      "首个识别题号为 " + questions[0].number + "，请检查是否漏掉前面的题目。",
    );
  }

  return { questions, warnings };
}

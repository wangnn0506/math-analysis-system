import { describe, expect, it } from "vitest";
import { splitQuestions } from "@/lib/documents/split";
import {
  normalizeQuestionNumber,
  parseQuestionNumberInput,
  safeDownloadName,
} from "@/lib/text";

describe("splitQuestions", () => {
  it("splits common Chinese exam question headings", () => {
    const input = [
      "高中数学测试",
      "一、选择题",
      "1. 已知集合 A，求下列正确选项。",
      "A. 选项一",
      "B. 选项二",
      "2、函数 f(x) 的定义域是（ ）",
      "第3题 求数列的通项公式。",
    ].join("\n");

    const result = splitQuestions(input);

    expect(result.questions.map((question) => question.number)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(result.questions[0].content).toContain("已知集合");
    expect(result.questions[0].content).toContain("A. 选项一");
    expect(result.questions[1].content).not.toContain("选择题");
    expect(result.questions[1].content).not.toContain("解答题");
    expect(result.questions[2].content).toBe("求数列的通项公式。");
  });

  it("marks duplicated numbers for teacher review", () => {
    const result = splitQuestions("1. 第一题\n1. 又一个第一题");

    expect(result.questions.map((question) => question.number)).toEqual([
      "1",
      "1-2",
    ]);
    expect(result.warnings[0]).toContain("重复题号");
  });

  it("keeps numbered subquestions inside the parent question", () => {
    const result = splitQuestions(
      "第3题 已知函数 f(x)=2ˣ。\n（1）求 f(0)；\n（2）判断单调性。",
    );

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].content).toContain("（1）求 f(0)");
    expect(result.questions[0].content).toContain("（2）判断单调性");
  });

  it("keeps the full text when no heading is recognized", () => {
    const result = splitQuestions("这是一段没有题号的文字。");

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].number).toBe("全文");
    expect(result.warnings[0]).toContain("未识别");
  });
});

describe("question number helpers", () => {
  it("normalizes and deduplicates teacher input", () => {
    expect(parseQuestionNumberInput("第２题, 5、8；5")).toEqual([
      "2",
      "5",
      "8",
    ]);
    expect(normalizeQuestionNumber("第 １２ 题")).toBe("12");
  });

  it("sanitizes Word download filenames", () => {
    expect(safeDownloadName('张三:"错题/集"')).toBe("张三--错题-集-");
  });
});

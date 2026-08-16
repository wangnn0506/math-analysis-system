import { NextResponse } from "next/server";
import { generateWrongBookDocument } from "@/lib/documents/generate";
import {
  createWrongBook,
  getDocumentWithQuestions,
  getStudent,
} from "@/lib/store";
import {
  buildWrongBookTitle,
  parseQuestionNumberInput,
  safeDownloadName,
} from "@/lib/text";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const studentId = String(formData.get("studentId") ?? "");
    const documentId = String(formData.get("documentId") ?? "");
    const requestedNumbers = parseQuestionNumberInput(
      String(formData.get("questionNumbers") ?? ""),
    );
    if (!studentId || !documentId || requestedNumbers.length === 0) {
      throw new Error("请选择学生、试卷并输入至少一个错题号");
    }
    if (requestedNumbers.length > 200) {
      throw new Error("一次最多选择 200 道错题");
    }

    const [student, documentData] = await Promise.all([
      getStudent(studentId),
      getDocumentWithQuestions(documentId),
    ]);
    if (!student || !documentData) throw new Error("学生或试卷不存在");

    const requestedSet = new Set(requestedNumbers);
    const questions = documentData.questions.filter((question) =>
      requestedSet.has(question.number),
    );
    const foundSet = new Set(questions.map((question) => question.number));
    const missing = requestedNumbers.filter((number) => !foundSet.has(number));
    if (missing.length > 0) {
      throw new Error("试卷中没有题号：" + missing.join("、"));
    }

    const title = buildWrongBookTitle({
      documentTitle: documentData.document.title,
      studentName: student.name,
      className: student.className,
      studentNo: student.studentNo,
    });
    const buffer = await generateWrongBookDocument({
      title,
      student,
      sourceDocument: documentData.document,
      questions,
    });
    await createWrongBook({
      studentId,
      documentId,
      title,
      questionNumbers: questions.map((question) => question.number),
    });

    const filename = safeDownloadName(title) + ".docx";
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition":
          'attachment; filename="wrong-book.docx"; filename*=UTF-8\'\'' +
          encodeURIComponent(filename),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new NextResponse(
      error instanceof Error ? error.message : "生成错题文档失败",
      {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }
}

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AppDatabase,
  ClassGroup,
  DashboardStats,
  DocumentPage,
  Question,
  QuestionAnchor,
  QuestionCropRegion,
  SourceDocument,
  Student,
  WrongBook,
} from "@/lib/types";

const dataDirectory = process.env.APP_DATA_DIR
  ? path.resolve(process.env.APP_DATA_DIR)
  : path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "db.json");
export const uploadDirectory = path.join(dataDirectory, "uploads");

const emptyDatabase = (): AppDatabase => ({
  version: 2,
  classes: [],
  students: [],
  documents: [],
  questions: [],
  wrongBooks: [],
});

declare global {
  var __mathPaperWriteQueue: Promise<void> | undefined;
}

async function ensureStorage() {
  await mkdir(uploadDirectory, { recursive: true });
  try {
    await readFile(databasePath);
  } catch {
    await writeFile(databasePath, JSON.stringify(emptyDatabase(), null, 2), "utf8");
  }
}

async function readDatabase(): Promise<AppDatabase> {
  await ensureStorage();
  const raw = await readFile(databasePath, "utf8");
  const parsed = JSON.parse(raw) as {
    version?: number;
    classes?: ClassGroup[];
    students?: Student[];
    documents?: SourceDocument[];
    questions?: Question[];
    wrongBooks?: WrongBook[];
  };
  if (parsed.version !== 1 && parsed.version !== 2) {
    throw new Error("不支持的数据文件版本");
  }

  const database = parsed as AppDatabase;
  if (!Array.isArray(database.classes)) database.classes = [];

  // Version 1 stored only a className on each student. Build stable class
  // records in memory so existing data can be used immediately; the next
  // write persists the upgraded version without dropping any student data.
  const classByName = new Map<string, ClassGroup>();
  const now = new Date().toISOString();
  for (const classGroup of database.classes) {
    if (classGroup?.id && classGroup?.name) classByName.set(classGroup.name, classGroup);
  }
  for (const student of database.students ?? []) {
    const className = String(student.className ?? "").trim();
    if (!className) {
      delete student.classId;
      continue;
    }
    let classGroup = student.classId
      ? database.classes.find((item) => item.id === student.classId)
      : undefined;
    if (!classGroup) {
      classGroup = classByName.get(className);
    }
    if (!classGroup) {
      classGroup = {
        id: legacyClassId(className),
        name: className,
        createdAt: student.createdAt || now,
        updatedAt: student.updatedAt || now,
      };
      database.classes.push(classGroup);
      classByName.set(className, classGroup);
    }
    student.classId = classGroup.id;
    student.className = classGroup.name;
  }
  database.version = 2;
  return database;
}

async function writeDatabase(database: AppDatabase) {
  const temporaryPath = databasePath + "." + randomUUID() + ".tmp";
  await writeFile(temporaryPath, JSON.stringify(database, null, 2), "utf8");
  await rename(temporaryPath, databasePath);
}

async function mutateDatabase<T>(mutator: (database: AppDatabase) => T | Promise<T>) {
  const previous = globalThis.__mathPaperWriteQueue ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalThis.__mathPaperWriteQueue = previous.then(() => current);

  await previous;
  try {
    const database = await readDatabase();
    const result = await mutator(database);
    await writeDatabase(database);
    return result;
  } finally {
    release();
  }
}

function assertMaximumLength(value: string, maximum: number, label: string) {
  if (value.length > maximum) {
    throw new Error(label + "不能超过 " + maximum + " 个字符");
  }
}

function legacyClassId(name: string) {
  const hex = createHash("sha256")
    .update("math-paper-legacy-class:" + name)
    .digest("hex")
    .slice(0, 32)
    .split("");
  // Turn the deterministic hash into a UUID-shaped value. Determinism is
  // important while a version-1 database is read before its first write.
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return [
    hex.slice(0, 8).join(""),
    hex.slice(8, 12).join(""),
    hex.slice(12, 16).join(""),
    hex.slice(16, 20).join(""),
    hex.slice(20, 32).join(""),
  ].join("-");
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const database = await readDatabase();
  return {
    students: database.students.length,
    documents: database.documents.length,
    questions: database.questions.length,
    wrongBooks: database.wrongBooks.length,
  };
}

export async function listClasses(): Promise<ClassGroup[]> {
  const database = await readDatabase();
  return [...database.classes].sort((a, b) =>
    a.name.localeCompare(b.name, "zh-CN"),
  );
}

export async function listClassesWithCounts() {
  const database = await readDatabase();
  return [...database.classes]
    .map((classGroup) => ({
      ...classGroup,
      studentCount: database.students.filter(
        (student) => student.classId === classGroup.id,
      ).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
}

export async function getClass(id: string): Promise<ClassGroup | null> {
  const database = await readDatabase();
  return database.classes.find((classGroup) => classGroup.id === id) ?? null;
}

export async function createClass(input: { name: string }) {
  return mutateDatabase((database) => {
    const name = input.name.trim();
    if (!name) throw new Error("请填写班级名称");
    assertMaximumLength(name, 100, "班级名称");
    if (database.classes.some((classGroup) => classGroup.name === name)) {
      throw new Error("该班级已存在");
    }
    const now = new Date().toISOString();
    const classGroup: ClassGroup = {
      id: randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
    };
    database.classes.push(classGroup);
    return classGroup;
  });
}

export async function updateClass(id: string, input: { name: string }) {
  return mutateDatabase((database) => {
    const classGroup = database.classes.find((item) => item.id === id);
    if (!classGroup) throw new Error("班级不存在");
    const name = input.name.trim();
    if (!name) throw new Error("请填写班级名称");
    assertMaximumLength(name, 100, "班级名称");
    if (
      database.classes.some(
        (item) => item.id !== id && item.name === name,
      )
    ) {
      throw new Error("该班级已存在");
    }
    classGroup.name = name;
    classGroup.updatedAt = new Date().toISOString();
    for (const student of database.students) {
      if (student.classId === id) student.className = name;
    }
    return classGroup;
  });
}

export async function listStudents(classId?: string): Promise<Student[]> {
  const database = await readDatabase();
  return database.students
    .filter((student) => !classId || student.classId === classId)
    .sort((a, b) =>
    [a.className, a.studentNo]
      .join("-")
      .localeCompare([b.className, b.studentNo].join("-"), "zh-CN"),
    );
}

export async function getStudent(id: string) {
  const database = await readDatabase();
  return database.students.find((student) => student.id === id) ?? null;
}

export async function createStudent(input: {
  studentNo: string;
  name: string;
  classId?: string;
  className?: string;
  notes?: string;
}) {
  return mutateDatabase((database) => {
    const studentNo = input.studentNo.trim();
    const name = input.name.trim();
    const requestedClassName = input.className?.trim() ?? "";
    const classGroup = input.classId
      ? database.classes.find((item) => item.id === input.classId)
      : requestedClassName
        ? database.classes.find((item) => item.name === requestedClassName)
        : undefined;
    if (input.classId && !classGroup) throw new Error("所选班级不存在");
    const classId = classGroup?.id;
    const className = classGroup?.name ?? requestedClassName;
    const notes = input.notes?.trim() ?? "";
    assertMaximumLength(studentNo, 64, "学号");
    assertMaximumLength(name, 100, "姓名");
    assertMaximumLength(className, 100, "班级");
    assertMaximumLength(notes, 500, "备注");
    if (database.students.some((student) => student.studentNo === studentNo)) {
      throw new Error("该学号已存在");
    }
    const now = new Date().toISOString();
    const student: Student = {
      id: randomUUID(),
      studentNo,
      name,
      classId,
      className,
      notes,
      createdAt: now,
      updatedAt: now,
    };
    database.students.push(student);
    return student;
  });
}

export async function updateStudent(
  id: string,
  input: {
    studentNo: string;
    name: string;
    classId?: string;
    className?: string;
    notes?: string;
  },
) {
  return mutateDatabase((database) => {
    const student = database.students.find((item) => item.id === id);
    if (!student) throw new Error("学生不存在");
    const studentNo = input.studentNo.trim();
    const name = input.name.trim();
    const requestedClassName = input.className?.trim() ?? "";
    const classGroup = input.classId
      ? database.classes.find((item) => item.id === input.classId)
      : requestedClassName
        ? database.classes.find((item) => item.name === requestedClassName)
        : undefined;
    if (input.classId && !classGroup) throw new Error("所选班级不存在");
    const classId = classGroup?.id;
    const className = classGroup?.name ?? requestedClassName;
    const notes = input.notes?.trim() ?? "";
    assertMaximumLength(studentNo, 64, "学号");
    assertMaximumLength(name, 100, "姓名");
    assertMaximumLength(className, 100, "班级");
    assertMaximumLength(notes, 500, "备注");
    if (
      database.students.some(
        (item) => item.id !== id && item.studentNo === studentNo,
      )
    ) {
      throw new Error("该学号已存在");
    }
    student.studentNo = studentNo;
    student.name = name;
    student.classId = classId;
    student.className = className;
    student.notes = notes;
    student.updatedAt = new Date().toISOString();
    return student;
  });
}

export async function importStudents(
  classId: string,
  rows: Array<{ rowNumber: number; studentNo: string; name: string }>,
) {
  return mutateDatabase((database) => {
    const classGroup = database.classes.find((item) => item.id === classId);
    if (!classGroup) throw new Error("所选班级不存在");
    if (rows.length === 0) throw new Error("没有可导入的学生");
    if (rows.length > 5000) throw new Error("一次最多导入 5000 名学生");

    const errors: Array<{ rowNumber: number; message: string }> = [];
    const accepted: Array<{ studentNo: string; name: string }> = [];
    const seen = new Set(database.students.map((student) => student.studentNo));
    for (const row of rows) {
      const studentNo = row.studentNo.trim();
      const name = row.name.trim();
      if (!studentNo || !name) {
        errors.push({ rowNumber: row.rowNumber, message: "学号和姓名不能为空" });
        continue;
      }
      if (studentNo.length > 64 || name.length > 100) {
        errors.push({ rowNumber: row.rowNumber, message: "学号或姓名过长" });
        continue;
      }
      if (seen.has(studentNo)) {
        errors.push({ rowNumber: row.rowNumber, message: "学号已存在或在文件中重复" });
        continue;
      }
      seen.add(studentNo);
      accepted.push({ studentNo, name });
    }

    const now = new Date().toISOString();
    for (const item of accepted) {
      database.students.push({
        id: randomUUID(),
        studentNo: item.studentNo,
        name: item.name,
        classId,
        className: classGroup.name,
        notes: "",
        createdAt: now,
        updatedAt: now,
      });
    }
    return { imported: accepted.length, skipped: errors.length, errors };
  });
}

export async function deleteStudent(id: string) {
  return mutateDatabase((database) => {
    if (database.wrongBooks.some((item) => item.studentId === id)) {
      throw new Error("该学生已有错题文档记录，暂不能删除");
    }
    database.students = database.students.filter((student) => student.id !== id);
  });
}

export async function listDocuments(): Promise<SourceDocument[]> {
  const database = await readDatabase();
  return database.documents.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDocumentWithQuestions(id: string) {
  const database = await readDatabase();
  const document = database.documents.find((item) => item.id === id);
  if (!document) return null;
  const questions = database.questions
    .filter((question) => question.documentId === id)
    .sort((a, b) => a.order - b.order);
  return { document, questions };
}

export async function getDocumentPage(documentId: string, pageIndex: number) {
  const database = await readDatabase();
  const document = database.documents.find((item) => item.id === documentId);
  const page = document?.pages?.[pageIndex];
  return document && page ? { document, page } : null;
}

export async function createDocument(input: {
  title: string;
  originalFilename: string;
  mimeType: string;
  filePath: string;
  processingMode?: "text" | "page-images";
  pages?: DocumentPage[];
  extractionWarnings: string[];
  questions: Array<{
    number: string;
    content: string;
    anchor?: QuestionAnchor;
    cropRegions?: QuestionCropRegion[];
  }>;
}) {
  return mutateDatabase((database) => {
    const now = new Date().toISOString();
    const title = input.title.trim();
    assertMaximumLength(title, 150, "试卷名称");
    const document: SourceDocument = {
      id: randomUUID(),
      title,
      originalFilename: input.originalFilename,
      mimeType: input.mimeType,
      filePath: input.filePath,
      processingMode: input.processingMode ?? "text",
      pages: input.pages ?? [],
      status: "READY",
      questionCount: input.questions.length,
      extractionWarnings: input.extractionWarnings,
      createdAt: now,
      updatedAt: now,
    };
    database.documents.push(document);
    input.questions.forEach((inputQuestion, index) => {
      database.questions.push({
        id: randomUUID(),
        documentId: document.id,
        number: inputQuestion.number,
        content: inputQuestion.content,
        anchor: inputQuestion.anchor,
        cropRegions: inputQuestion.cropRegions,
        order: index + 1,
        createdAt: now,
        updatedAt: now,
      });
    });
    return document;
  });
}

export async function replaceImageQuestions(
  documentId: string,
  inputQuestions: Array<{
    number: string;
    content: string;
    anchor: QuestionAnchor;
    cropRegions: QuestionCropRegion[];
  }>,
  extractionWarnings?: string[],
) {
  return mutateDatabase((database) => {
    const document = database.documents.find((item) => item.id === documentId);
    if (!document) throw new Error("试卷不存在");
    if (document.processingMode !== "page-images" || !document.pages?.length) {
      throw new Error("这份试卷不是图片切题模式");
    }
    if (inputQuestions.length === 0 || inputQuestions.length > 200) {
      throw new Error("题号标记数量应为 1–200 个");
    }

    const seenNumbers = new Set<string>();
    for (const question of inputQuestions) {
      const number = question.number.trim();
      const page = document.pages[question.anchor.pageIndex];
      if (!/^\d{1,3}$/.test(number) || Number(number) < 1 || Number(number) > 200) {
        throw new Error("题号必须是 1–200 的整数");
      }
      if (seenNumbers.has(number)) throw new Error("题号 " + number + " 重复");
      seenNumbers.add(number);
      if (
        !page ||
        question.anchor.x < 0 ||
        question.anchor.y < 0 ||
        question.anchor.x > page.width ||
        question.anchor.y > page.height
      ) {
        throw new Error("题号 " + number + " 的位置超出页面范围");
      }
    }

    const now = new Date().toISOString();
    database.questions = database.questions.filter(
      (question) => question.documentId !== documentId,
    );
    const questions = inputQuestions.map((inputQuestion, index): Question => ({
      id: randomUUID(),
      documentId,
      number: inputQuestion.number.trim(),
      content: inputQuestion.content,
      anchor: inputQuestion.anchor,
      cropRegions: inputQuestion.cropRegions,
      order: index + 1,
      createdAt: now,
      updatedAt: now,
    }));
    database.questions.push(...questions);
    document.questionCount = questions.length;
    if (extractionWarnings) document.extractionWarnings = extractionWarnings;
    document.updatedAt = now;
    return questions;
  });
}

export async function addQuestion(
  documentId: string,
  input: { number: string; content: string },
) {
  return mutateDatabase((database) => {
    const document = database.documents.find((item) => item.id === documentId);
    if (!document) throw new Error("试卷不存在");
    const number = input.number.trim();
    const content = input.content.trim();
    assertMaximumLength(number, 32, "题号");
    assertMaximumLength(content, 100_000, "题目内容");
    if (
      database.questions.some(
        (question) =>
          question.documentId === documentId &&
          question.number === number,
      )
    ) {
      throw new Error("题号已存在");
    }
    const now = new Date().toISOString();
    const order =
      Math.max(
        0,
        ...database.questions
          .filter((question) => question.documentId === documentId)
          .map((question) => question.order),
      ) + 1;
    const question: Question = {
      id: randomUUID(),
      documentId,
      number,
      content,
      cropRegions: [],
      order,
      createdAt: now,
      updatedAt: now,
    };
    database.questions.push(question);
    document.questionCount += 1;
    document.updatedAt = now;
    return question;
  });
}

export async function updateQuestion(
  id: string,
  input: { number: string; content: string },
) {
  return mutateDatabase((database) => {
    const question = database.questions.find((item) => item.id === id);
    if (!question) throw new Error("题目不存在");
    const number = input.number.trim();
    const content = input.content.trim();
    assertMaximumLength(number, 32, "题号");
    assertMaximumLength(content, 100_000, "题目内容");
    if (
      database.questions.some(
        (item) =>
          item.id !== id &&
          item.documentId === question.documentId &&
          item.number === number,
      )
    ) {
      throw new Error("题号已存在");
    }
    question.number = number;
    question.content = content;
    question.updatedAt = new Date().toISOString();
    return question;
  });
}

export async function deleteQuestion(id: string) {
  return mutateDatabase((database) => {
    const question = database.questions.find((item) => item.id === id);
    if (!question) return;
    database.questions = database.questions.filter((item) => item.id !== id);
    const document = database.documents.find(
      (item) => item.id === question.documentId,
    );
    if (document) {
      document.questionCount = Math.max(0, document.questionCount - 1);
      document.updatedAt = new Date().toISOString();
    }
  });
}

export async function deleteDocument(id: string) {
  let filePaths: string[] = [];
  await mutateDatabase((database) => {
    const document = database.documents.find((item) => item.id === id);
    if (!document) return;
    if (database.wrongBooks.some((item) => item.documentId === id)) {
      throw new Error("该试卷已有错题文档记录，暂不能删除");
    }
    filePaths = [
      document.filePath,
      ...(document.pages ?? []).map((page) => page.imagePath),
    ];
    database.documents = database.documents.filter((item) => item.id !== id);
    database.questions = database.questions.filter(
      (question) => question.documentId !== id,
    );
  });
  await Promise.all(filePaths.map((filePath) => unlink(filePath).catch(() => undefined)));
}

export async function listWrongBooks() {
  const database = await readDatabase();
  return database.wrongBooks
    .map((item) => ({
      ...item,
      student: database.students.find((student) => student.id === item.studentId),
      document: database.documents.find(
        (document) => document.id === item.documentId,
      ),
    }))
    .filter((item) => item.student && item.document)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createWrongBook(input: {
  studentId: string;
  documentId: string;
  title: string;
  questionNumbers: string[];
}) {
  return mutateDatabase((database) => {
    assertMaximumLength(input.title, 150, "文档标题");
    if (!database.students.some((item) => item.id === input.studentId)) {
      throw new Error("学生不存在");
    }
    if (!database.documents.some((item) => item.id === input.documentId)) {
      throw new Error("试卷不存在");
    }
    const wrongBook: WrongBook = {
      id: randomUUID(),
      studentId: input.studentId,
      documentId: input.documentId,
      title: input.title,
      questionNumbers: input.questionNumbers,
      createdAt: new Date().toISOString(),
    };
    database.wrongBooks.push(wrongBook);
    return wrongBook;
  });
}

export async function getWrongBookDownloadData(id: string) {
  const database = await readDatabase();
  const wrongBook = database.wrongBooks.find((item) => item.id === id);
  if (!wrongBook) return null;
  const student = database.students.find(
    (item) => item.id === wrongBook.studentId,
  );
  const document = database.documents.find(
    (item) => item.id === wrongBook.documentId,
  );
  if (!student || !document) return null;
  const numberSet = new Set(wrongBook.questionNumbers);
  const questions = database.questions
    .filter(
      (question) =>
        question.documentId === document.id && numberSet.has(question.number),
    )
    .sort((a, b) => a.order - b.order);
  return { wrongBook, student, document, questions };
}

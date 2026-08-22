export type ClassGroup = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ParentAccount = {
  id: string;
  studentId: string;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  phone: string;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};

export type CuratedPaper = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  description: string;
  documentId: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ScoreRecord = {
  id: string;
  studentId: string;
  examName: string;
  subject: string;
  score: number;
  totalScore: number;
  examDate: string;
  createdAt: string;
};

export type KnowledgePoint = {
  id: string;
  name: string;
  subject: string;
  createdAt: string;
};

export type Student = {
  id: string;
  studentNo: string;
  name: string;
  /** Stable relation to a class. Optional only for backwards-compatible data migration. */
  classId?: string;
  className: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type SourceDocument = {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  filePath: string;
  processingMode?: "text" | "page-images";
  pages?: DocumentPage[];
  status: "READY" | "FAILED";
  questionCount: number;
  extractionWarnings: string[];
  createdAt: string;
  updatedAt: string;
};

export type DocumentPage = {
  imagePath: string;
  width: number;
  height: number;
};

export type QuestionAnchor = {
  pageIndex: number;
  x: number;
  y: number;
};

export type QuestionCropRegion = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Question = {
  id: string;
  documentId: string;
  number: string;
  content: string;
  knowledgePointIds?: string[];
  anchor?: QuestionAnchor;
  cropRegions?: QuestionCropRegion[];
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type WrongBook = {
  id: string;
  studentId: string;
  documentId: string;
  title: string;
  questionNumbers: string[];
  createdAt: string;
};

export type AppDatabase = {
  version: 3;
  classes: ClassGroup[];
  parentAccounts: ParentAccount[];
  curatedPapers: CuratedPaper[];
  scoreRecords: ScoreRecord[];
  knowledgePoints: KnowledgePoint[];
  students: Student[];
  documents: SourceDocument[];
  questions: Question[];
  wrongBooks: WrongBook[];
};

export type DashboardStats = {
  students: number;
  documents: number;
  questions: number;
  wrongBooks: number;
};

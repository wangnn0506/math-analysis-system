export type Student = {
  id: string;
  studentNo: string;
  name: string;
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
  version: 1;
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

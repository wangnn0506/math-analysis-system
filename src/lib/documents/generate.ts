import { readFile } from "node:fs/promises";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
  convertInchesToTwip,
} from "docx";
import { cropPng } from "@/lib/documents/image-questions";
import type { Question, SourceDocument, Student } from "@/lib/types";

const BLUE = "2E74B5";
const DARK = "1F2937";
const MUTED = "667085";

async function questionParagraphs(
  question: Question,
  sourceDocument: SourceDocument,
  pageImageCache: Map<string, Buffer>,
) {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 200 },
      keepNext: true,
      children: [
        new TextRun({
          text: "第 " + question.number + " 题",
          bold: true,
          color: BLUE,
          size: 32,
          font: "Microsoft YaHei",
        }),
      ],
    }),
  ];

  if (question.cropRegions?.length && sourceDocument.pages?.length) {
    for (const [regionIndex, region] of question.cropRegions.entries()) {
      const page = sourceDocument.pages[region.pageIndex];
      if (!page) continue;
      let pageImage = pageImageCache.get(page.imagePath);
      if (!pageImage) {
        pageImage = await readFile(page.imagePath);
        pageImageCache.set(page.imagePath, pageImage);
      }
      const crop = cropPng(pageImage, region);
      const scale = Math.min(624 / crop.width, 760 / crop.height, 1);
      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: regionIndex === 0 ? 40 : 80, after: 80 },
          children: [
            new ImageRun({
              data: crop.buffer,
              type: "png",
              transformation: {
                width: Math.max(1, Math.round(crop.width * scale)),
                height: Math.max(1, Math.round(crop.height * scale)),
              },
              altText: {
                title: "第 " + question.number + " 题",
                description: "从原试卷裁剪的题目图片",
                name: "question-" + question.number + "-" + (regionIndex + 1),
              },
            }),
          ],
        }),
      );
    }
  } else {
    const lines = question.content.split(/\n/);
    for (const line of lines) {
      const pageMarker = /^\[第 \d+ 页\]$/.test(line.trim());
      paragraphs.push(
        new Paragraph({
          spacing: pageMarker
            ? { before: 80, after: 60 }
            : { before: 0, after: 120, line: 300, lineRule: LineRuleType.AUTO },
          children: [
            new TextRun({
              text: line || " ",
              color: pageMarker ? MUTED : DARK,
              italics: pageMarker,
              size: pageMarker ? 18 : 22,
              font: "Microsoft YaHei",
            }),
          ],
        }),
      );
    }
  }

  paragraphs.push(
    new Paragraph({
      spacing: { before: 120, after: 120 },
      border: {
        bottom: {
          color: "D0D5DD",
          style: BorderStyle.SINGLE,
          size: 4,
          space: 8,
        },
      },
      children: [new TextRun({ text: " ", size: 2 })],
    }),
  );
  return paragraphs;
}

export async function generateWrongBookDocument(input: {
  title: string;
  student: Student;
  sourceDocument: SourceDocument;
  questions: Question[];
}) {
  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 100 },
      children: [
        new TextRun({
          text: input.title,
          bold: true,
          color: "0B2545",
          size: 48,
          font: "Microsoft YaHei",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text:
            "学生：" +
            input.student.name +
            "  ·  学号：" +
            input.student.studentNo +
            (input.student.className ? "  ·  班级：" + input.student.className : ""),
          color: MUTED,
          size: 21,
          font: "Microsoft YaHei",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: "来源试卷：" + input.sourceDocument.title,
          color: MUTED,
          size: 20,
          font: "Microsoft YaHei",
        }),
      ],
    }),
  ];

  const pageImageCache = new Map<string, Buffer>();
  for (const question of input.questions) {
    children.push(
      ...(await questionParagraphs(
        question,
        input.sourceDocument,
        pageImageCache,
      )),
    );
  }

  const document = new Document({
    creator: "高中数学错题整理系统",
    title: input.title,
    description: "按学生错题号自动生成的错题练习文档",
    styles: {
      default: {
        document: {
          run: {
            font: "Microsoft YaHei",
            size: 22,
            color: DARK,
          },
          paragraph: {
            spacing: { after: 120, line: 300, lineRule: LineRuleType.AUTO },
          },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            font: "Microsoft YaHei",
            size: 32,
            bold: true,
            color: BLUE,
          },
          paragraph: {
            spacing: { before: 360, after: 200 },
            keepNext: true,
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertInchesToTwip(8.5),
              height: convertInchesToTwip(11),
            },
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              header: convertInchesToTwip(0.492),
              footer: convertInchesToTwip(0.492),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: "高中数学错题整理  ·  第 ",
                    color: MUTED,
                    size: 18,
                    font: "Microsoft YaHei",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    color: MUTED,
                    size: 18,
                    font: "Microsoft YaHei",
                  }),
                  new TextRun({
                    text: " 页",
                    color: MUTED,
                    size: 18,
                    font: "Microsoft YaHei",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}

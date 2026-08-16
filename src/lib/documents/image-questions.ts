import { createWorker, OEM, PSM } from "tesseract.js";
import chiSimData from "@tesseract.js-data/chi_sim";
import { PNG } from "pngjs";
import type { ExtractedPageImage } from "@/lib/documents/extract";
import type {
  QuestionAnchor,
  QuestionCropRegion,
} from "@/lib/types";

type OcrLine = {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

type PageSize = { width: number; height: number };

type DetectionCandidate = QuestionAnchor & {
  number: string;
  score: number;
};

export type LocatedImageQuestion = {
  number: string;
  content: string;
  anchor: QuestionAnchor;
  cropRegions: QuestionCropRegion[];
};

function collectLines(blocks: Tesseract.Block[] | null): OcrLine[] {
  const lines: OcrLine[] = [];
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const text = line.text.replace(/\s+/g, " ").trim();
        if (text) lines.push({ text, bbox: line.bbox });
      }
    }
  }
  return lines;
}

function questionNumberToken(text: string) {
  const normalized = text.trim();
  const match = normalized.match(
    /^([0-9IlLoOsS|]{1,3})(?=\s|[.．、,，:：)]|$)/,
  );
  const chineseMatch = normalized.match(
    /^第\s*([0-9IlLoOsS|]{1,3})\s*题/,
  );
  return match?.[1] ?? chineseMatch?.[1] ?? null;
}

function tokenToDigits(token: string) {
  return token
    .replace(/[IlL|]/g, "1")
    .replace(/[Oo]/g, "0")
    .replace(/[Ss]/g, "5");
}

function numberAtLineStartCandidates(text: string) {
  const token = questionNumberToken(text);
  if (!token) return [];

  // Keep both interpretations for an ambiguous terminal S. For example,
  // Tesseract may read the printed “15.” as “15S.”. The sequence resolver can
  // then prefer 15 while still retaining 155 for a genuine three-digit label.
  const tokens =
    /[Ss]$/.test(token) && token.length > 1
      ? [token.slice(0, -1), token, token.replace(/[Ss]/g, "")]
      : [token, token.replace(/[Ss]/g, "")];
  const numbers: string[] = [];
  for (const candidateToken of tokens) {
    const digits = tokenToDigits(candidateToken);
    if (!/^\d{1,3}$/.test(digits)) continue;
    const value = Number(digits);
    if (value < 1 || value > 200 || numbers.includes(digits)) continue;
    numbers.push(digits);
  }
  return numbers;
}

export function numberAtLineStart(text: string): string | null {
  return numberAtLineStartCandidates(text)[0] ?? null;
}

function makeCropRegions(
  pages: PageSize[],
  anchors: Array<QuestionAnchor & { number: string }>,
  index: number,
) {
  const anchor = anchors[index];
  const next = anchors[index + 1];
  const regions: QuestionCropRegion[] = [];

  for (
    let pageIndex = anchor.pageIndex;
    pageIndex <= (next?.pageIndex ?? pages.length - 1);
    pageIndex += 1
  ) {
    const page = pages[pageIndex];
    const contentTop = Math.round(page.height * 0.085);
    const contentBottom = Math.round(page.height * 0.915);
    const x = Math.round(page.width * 0.065);
    const width = Math.round(page.width * 0.875);
    const y =
      pageIndex === anchor.pageIndex
        ? Math.max(contentTop, anchor.y - Math.round(page.height * 0.008))
        : contentTop;
    const bottom =
      next && pageIndex === next.pageIndex
        ? Math.min(contentBottom, next.y - Math.round(page.height * 0.007))
        : contentBottom;
    const height = bottom - y;
    if (height >= 24) regions.push({ pageIndex, x, y, width, height });
    if (next && pageIndex === next.pageIndex) break;
  }

  return regions;
}

export function buildImageQuestionsFromAnchors(
  pages: PageSize[],
  anchors: Array<QuestionAnchor & { number: string }>,
): LocatedImageQuestion[] {
  const ordered = [...anchors].sort(
    (a, b) => a.pageIndex - b.pageIndex || a.y - b.y,
  );
  return ordered.map((anchor, index) => ({
    number: anchor.number,
    content: "题目内容保留为原试卷截图",
    anchor: {
      pageIndex: anchor.pageIndex,
      x: anchor.x,
      y: anchor.y,
    },
    cropRegions: makeCropRegions(pages, ordered, index),
  }));
}

function chooseSequentialCandidates(candidates: DetectionCandidate[]) {
  const byNumber = new Map<number, DetectionCandidate[]>();
  for (const candidate of candidates) {
    const value = Number(candidate.number);
    const group = byNumber.get(value) ?? [];
    group.push(candidate);
    byNumber.set(value, group);
  }

  const accepted: DetectionCandidate[] = [];
  let previousPosition = -1;
  for (let number = 1; number <= 200; number += 1) {
    const available = (byNumber.get(number) ?? [])
      .filter(
        (candidate) =>
          candidate.pageIndex * 100_000 + candidate.y > previousPosition,
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.pageIndex - b.pageIndex ||
          a.y - b.y,
      );
    let chosen = available[0];
    if (!chosen) {
      // Do not stop the entire document because one label was missed. Move to
      // the next higher candidate and let the missing-number warning surface in
      // the UI; later questions can still be selected and corrected manually.
      const nextHigher = [...byNumber.entries()]
        .filter(([value, group]) =>
          value > number &&
          group.some(
            (candidate) =>
              candidate.pageIndex * 100_000 + candidate.y > previousPosition,
          ),
        )
        .sort(([a], [b]) => a - b)[0];
      if (!nextHigher) break;
      chosen = nextHigher[1]
        .filter(
          (candidate) =>
            candidate.pageIndex * 100_000 + candidate.y > previousPosition,
        )
        .sort(
          (a, b) =>
            b.score - a.score ||
            a.pageIndex - b.pageIndex ||
            a.y - b.y,
        )[0];
      if (!chosen) break;
      number = Number(chosen.number) - 1;
    }
    accepted.push(chosen);
    previousPosition = chosen.pageIndex * 100_000 + chosen.y;
  }
  return accepted;
}

export async function locateImageQuestions(pages: ExtractedPageImage[]) {
  if (pages.length === 0) throw new Error("没有可处理的试卷页面");
  const worker = await createWorker("chi_sim", OEM.LSTM_ONLY, {
    langPath: chiSimData.langPath,
    gzip: chiSimData.gzip,
    cacheMethod: "none",
  });
  const detected: DetectionCandidate[] = [];

  try {
    // Scan the same left-side question area on every page. We only retain
    // explicit line-start candidates; no colour or one-question-per-page rule
    // is used here.
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const page = pages[pageIndex];
      const scanWidth = Math.round(page.width * 0.35);
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
        tessedit_char_whitelist: "",
      });
      const result = await worker.recognize(
        page.buffer,
        { rectangle: { left: 0, top: 0, width: scanWidth, height: page.height } },
        { blocks: true },
      );
      const lines = collectLines(result.data.blocks);

      for (const line of lines) {
        const numbers = numberAtLineStartCandidates(line.text);
        if (
          numbers.length > 0 &&
          line.bbox.x0 <= page.width * 0.13 &&
          line.bbox.y0 >= page.height * 0.08 &&
          line.bbox.y0 <= page.height * 0.93
        ) {
          numbers.forEach((number, candidateIndex) => {
            detected.push({
              number,
              pageIndex,
              x: line.bbox.x0,
              y: line.bbox.y0,
              score: 70 - candidateIndex * 8,
            });
          });
        }
      }

      const possibleMisses = lines.filter((line) => {
        const xRatio = line.bbox.x0 / page.width;
        return (
          !numberAtLineStart(line.text) &&
          xRatio >= 0.108 &&
          xRatio <= 0.14 &&
          line.bbox.y0 >= page.height * 0.08 &&
          line.bbox.y0 <= page.height * 0.9 &&
          line.text.length >= 2
        );
      });

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        tessedit_char_whitelist: "",
      });
      for (const candidate of possibleMisses) {
        const top = Math.max(0, candidate.bbox.y0 - 18);
        const label = await worker.recognize(page.buffer, {
          rectangle: {
            left: Math.round(page.width * 0.075),
            top,
            width: Math.round(page.width * 0.065),
            height: Math.min(70, page.height - top),
          },
        });
        const rawLabel = label.data.text.trim();
        if (/[(（]\s*[iIl|]{1,4}\s*[)）]/.test(rawLabel)) continue;
        numberAtLineStartCandidates(rawLabel).forEach((number, candidateIndex) => {
          detected.push({
            number,
            pageIndex,
            x: Math.round(page.width * 0.09),
            y: candidate.bbox.y0,
            score: 35 - candidateIndex * 5,
          });
        });
      }
    }
  } finally {
    await worker.terminate();
  }

  const deduplicated = detected.filter(
    (anchor, index, all) =>
      !all.some(
        (other, otherIndex) =>
          otherIndex < index &&
          other.number === anchor.number &&
          other.pageIndex === anchor.pageIndex &&
          Math.abs(other.y - anchor.y) < 80 &&
          other.score >= anchor.score,
      ),
  );
  const sequential = chooseSequentialCandidates(deduplicated);
  const ordered = [...deduplicated].sort(
    (a, b) => a.pageIndex - b.pageIndex || a.y - b.y || b.score - a.score,
  );
  const monotonic: DetectionCandidate[] = [];
  for (const anchor of ordered) {
    const previous = monotonic.at(-1);
    if (!previous || Number(anchor.number) > Number(previous.number)) {
      monotonic.push(anchor);
    }
  }
  const accepted = sequential.length >= 3 ? sequential : monotonic;
  if (accepted.length === 0) {
    throw new Error("未能定位试卷题号，请确认页面清晰且题号位于题目开头");
  }

  const questions = buildImageQuestionsFromAnchors(pages, accepted);
  const numbers = new Set(accepted.map((item) => Number(item.number)));
  const minimum = Math.min(...numbers);
  const maximum = Math.max(...numbers);
  const missing: number[] = [];
  for (let number = minimum; number <= maximum; number += 1) {
    if (!numbers.has(number)) missing.push(number);
  }

  return {
    questions,
    warnings:
      missing.length > 0
        ? ["题号可能有遗漏（" + missing.join("、") + "），请在完整试卷预览中核对。"]
        : [],
  };
}

export function cropPng(buffer: Buffer, region: QuestionCropRegion) {
  const source = PNG.sync.read(buffer, { skipRescale: true });
  const x = Math.max(0, Math.min(source.width - 1, Math.round(region.x)));
  const y = Math.max(0, Math.min(source.height - 1, Math.round(region.y)));
  const width = Math.max(1, Math.min(source.width - x, Math.round(region.width)));
  const height = Math.max(1, Math.min(source.height - y, Math.round(region.height)));
  const output = new PNG({ width, height });
  PNG.bitblt(source, output, x, y, width, height, 0, 0);
  return {
    buffer: PNG.sync.write(output),
    width,
    height,
  };
}

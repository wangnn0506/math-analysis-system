"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, useMemo, useState } from "react";
import type { Question, QuestionAnchor, Student } from "@/lib/types";

type PagePreview = {
  pageNumber: number;
  width: number;
  height: number;
  imageUrl: string;
};

type Marker = {
  id: string;
  number: string;
  anchor: QuestionAnchor;
};

function markersFromQuestions(questions: Question[]): Marker[] {
  return questions.flatMap((question) =>
    question.anchor
      ? [{ id: question.id, number: question.number, anchor: question.anchor }]
      : [],
  );
}

function nextAvailableNumber(markers: Marker[], start = 1) {
  const used = new Set(markers.map((marker) => Number(marker.number)));
  let value = Math.max(1, start);
  while (used.has(value) && value <= 200) value += 1;
  return Math.min(value, 200);
}

export function PaperSelector({
  documentId,
  documentTitle,
  pages,
  questions,
  students,
}: {
  documentId: string;
  documentTitle: string;
  pages: PagePreview[];
  questions: Question[];
  students: Student[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [markers, setMarkers] = useState<Marker[]>(() =>
    markersFromQuestions(questions),
  );
  const [editing, setEditing] = useState(false);
  const [markerNumber, setMarkerNumber] = useState(() =>
    String(nextAvailableNumber(markersFromQuestions(questions))),
  );
  const [busy, setBusy] = useState<"save" | "reprocess" | null>(null);
  const [toolMessage, setToolMessage] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggleQuestion(number: string) {
    setSelected((current) =>
      current.includes(number)
        ? current.filter((item) => item !== number)
        : [...current, number],
    );
  }

  function removeMarker(id: string) {
    setMarkers((current) => current.filter((marker) => marker.id !== id));
    setToolMessage("已移除标记，点击“保存题号标记”后生效。");
  }

  function addMarker(event: MouseEvent<HTMLDivElement>, page: PagePreview) {
    if (!editing || (event.target as HTMLElement).closest("button")) return;
    const number = markerNumber.trim();
    const value = Number(number);
    if (!/^\d{1,3}$/.test(number) || value < 1 || value > 200) {
      setToolMessage("请输入 1–200 的题号后，再点击题目开头。");
      return;
    }
    if (markers.some((marker) => marker.number === number)) {
      setToolMessage("第 " + number + " 题已经有标记，请先删除旧标记。");
      return;
    }

    const rectangle = event.currentTarget.getBoundingClientRect();
    const x = Math.round(
      ((event.clientX - rectangle.left) / rectangle.width) * page.width,
    );
    const y = Math.round(
      ((event.clientY - rectangle.top) / rectangle.height) * page.height,
    );
    const updated = [
      ...markers,
      {
        id: "draft-" + crypto.randomUUID(),
        number,
        anchor: { pageIndex: page.pageNumber - 1, x, y },
      },
    ];
    setMarkers(updated);
    setMarkerNumber(String(nextAvailableNumber(updated, value + 1)));
    setToolMessage("已放置第 " + number + " 题标记。");
  }

  async function saveMarkers() {
    setBusy("save");
    setToolMessage("正在保存题号位置…");
    try {
      const response = await fetch("/api/documents/" + documentId + "/questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markers: markers.map((marker) => ({
            number: marker.number,
            ...marker.anchor,
          })),
        }),
      });
      const result = (await response.json()) as {
        questions?: Question[];
        error?: string;
      };
      if (!response.ok || !result.questions) {
        throw new Error(result.error || "保存失败");
      }
      const updated = markersFromQuestions(result.questions);
      setMarkers(updated);
      setSelected((current) =>
        current.filter((number) => updated.some((marker) => marker.number === number)),
      );
      setEditing(false);
      setToolMessage("题号位置已保存，共 " + updated.length + " 题。");
      router.refresh();
    } catch (error) {
      setToolMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(null);
    }
  }

  async function reprocess() {
    setBusy("reprocess");
    setToolMessage("正在根据新版规则重新识别题号…");
    try {
      const response = await fetch("/api/documents/" + documentId + "/reprocess", {
        method: "POST",
      });
      const result = (await response.json()) as {
        questions?: Question[];
        error?: string;
      };
      if (!response.ok || !result.questions) {
        throw new Error(result.error || "重新识别失败");
      }
      const updated = markersFromQuestions(result.questions);
      setMarkers(updated);
      setSelected([]);
      setEditing(false);
      setMarkerNumber(String(nextAvailableNumber(updated)));
      setToolMessage("重新识别完成，共定位 " + updated.length + " 题。");
      router.refresh();
    } catch (error) {
      setToolMessage(error instanceof Error ? error.message : "重新识别失败");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="paper-selection-layout">
      <section className="paper-pages" aria-label="完整试卷预览">
        {pages.map((page) => {
          const pageMarkers = markers.filter(
            (marker) => marker.anchor.pageIndex === page.pageNumber - 1,
          );
          return (
            <article className="paper-page-card" key={page.pageNumber}>
              <div className="paper-page-label">第 {page.pageNumber} 页</div>
              <div
                className={"paper-image-stage" + (editing ? " marker-editing" : "")}
                style={{ aspectRatio: page.width + " / " + page.height }}
                onClick={(event) => addMarker(event, page)}
              >
                {/* Original page pixels are deliberately served without OCR reconstruction. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.imageUrl}
                  alt={documentTitle + "第 " + page.pageNumber + " 页"}
                  width={page.width}
                  height={page.height}
                  draggable={false}
                />
                {pageMarkers.map((marker) => {
                  const checked = selectedSet.has(marker.number);
                  return (
                    <button
                      className={
                        "question-pick-button" +
                        (checked ? " selected" : "") +
                        (editing ? " editing" : "")
                      }
                      key={marker.id}
                      type="button"
                      aria-pressed={editing ? undefined : checked}
                      aria-label={
                        editing
                          ? "删除第 " + marker.number + " 题标记"
                          : (checked ? "取消选择" : "选择") +
                            "第 " +
                            marker.number +
                            " 题"
                      }
                      title={
                        editing
                          ? "删除这个题号标记"
                          : (checked ? "已选择" : "加入错题") +
                            "：第 " +
                            marker.number +
                            " 题"
                      }
                      style={{
                        left:
                          Math.max(
                            0.7,
                            (marker.anchor.x / page.width) * 100 - 4.8,
                          ) + "%",
                        top: (marker.anchor.y / page.height) * 100 + "%",
                      }}
                      onClick={() =>
                        editing
                          ? removeMarker(marker.id)
                          : toggleQuestion(marker.number)
                      }
                    >
                      <span aria-hidden="true">
                        {editing ? "×" : checked ? "✓" : "+"}
                      </span>
                      <small>{marker.number}</small>
                    </button>
                  );
                })}
              </div>
            </article>
          );
        })}
      </section>

      <aside className="paper-selection-panel">
        <div className="marker-tools">
          <div className="marker-tools-heading">
            <div>
              <p className="eyebrow">题号定位</p>
              <strong>{markers.length} 道题</strong>
            </div>
            <button
              className="button button-secondary button-small"
              type="button"
              disabled={Boolean(busy)}
              onClick={() => {
                setEditing((current) => !current);
                setToolMessage("");
              }}
            >
              {editing ? "退出校正" : "人工校正"}
            </button>
          </div>

          {editing ? (
            <div className="marker-editor">
              <label>
                <span>要添加的题号</span>
                <input
                  inputMode="numeric"
                  value={markerNumber}
                  onChange={(event) => setMarkerNumber(event.target.value)}
                />
              </label>
              <p>点击页面中的题目开头即可添加；点击已有的 × 题号可删除。</p>
              <button
                className="button button-primary button-full"
                type="button"
                disabled={busy === "save" || markers.length === 0}
                onClick={saveMarkers}
              >
                {busy === "save" ? "正在保存…" : "保存题号标记"}
              </button>
            </div>
          ) : (
            <button
              className="marker-reprocess-button"
              type="button"
              disabled={Boolean(busy)}
              onClick={reprocess}
            >
              {busy === "reprocess" ? "正在重新识别…" : "用新版规则重新识别"}
            </button>
          )}
          {toolMessage && (
            <p className="marker-tool-message" aria-live="polite">
              {toolMessage}
            </p>
          )}
        </div>

        <p className="eyebrow">当前错题</p>
        <h2>勾选后直接生成</h2>
        <p className="selection-help">
          点击试卷题号左侧的按钮。系统会按原题边界裁剪图片，公式和图形不会被转写。
        </p>
        <div className="selected-summary" aria-live="polite">
          <strong>{selected.length} 道</strong>
          <span>{selected.length ? "已加入本次错题" : "尚未选择题目"}</span>
        </div>
        {selected.length > 0 && (
          <div className="selected-question-list">
            {selected.map((number) => (
              <button type="button" key={number} onClick={() => toggleQuestion(number)}>
                第 {number} 题 <span>×</span>
              </button>
            ))}
          </div>
        )}

        {students.length === 0 ? (
          <div className="selection-empty-students">
            <p>需要先添加一名学生，才能生成错题文档。</p>
            <Link className="button button-primary button-full" href="/students">
              去添加学生
            </Link>
          </div>
        ) : (
          <form action="/api/wrong-books" method="post" className="paper-generate-form">
            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="questionNumbers" value={selected.join(",")} />
            <label>
              <span>选择学生 *</span>
              <select name="studentId" required defaultValue="">
                <option value="" disabled>
                  请选择学生
                </option>
                {students.map((student) => (
                  <option value={student.id} key={student.id}>
                    {student.name} · {student.studentNo}
                    {student.className ? " · " + student.className : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="auto-document-title">
              文档名称将自动使用：试卷名称 · 学生姓名 · 班级 · 学号
            </p>
            <button
              className="button button-primary button-full button-large"
              type="submit"
              disabled={selected.length === 0 || editing}
            >
              生成并下载错题 Word
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}

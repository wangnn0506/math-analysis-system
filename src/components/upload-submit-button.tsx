"use client";

import { useFormStatus } from "react-dom";

export function UploadSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="button button-primary"
      type="submit"
      disabled={pending}
    >
      {pending ? "上传中…" : "上传文件"}
    </button>
  );
}

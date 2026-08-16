export function Notice({
  type,
  message,
}: {
  type: "success" | "error" | "warning";
  message?: string;
}) {
  if (!message) return null;
  return (
    <div className={"notice notice-" + type} role={type === "error" ? "alert" : "status"}>
      <span className="notice-dot" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

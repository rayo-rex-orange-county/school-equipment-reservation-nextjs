export class ApiError extends Error {
  status: number;
  conflicts?: { kind: string; subject: string; message: string }[];
  constructor(message: string, status: number, conflicts?: ApiError["conflicts"]) {
    super(message);
    this.status = status;
    this.conflicts = conflicts;
  }
}

async function handle(res: Response) {
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => ({})) : {};
  if (!res.ok) throw new ApiError(body.error || "Something went wrong.", res.status, body.conflicts);
  return body;
}

export const api = {
  get: (url: string) => fetch(url, { cache: "no-store" }).then(handle),
  post: (url: string, data?: unknown) =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data ?? {}) }).then(handle),
  patch: (url: string, data: unknown) =>
    fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(handle),
  delete: (url: string) => fetch(url, { method: "DELETE" }).then(handle),
};

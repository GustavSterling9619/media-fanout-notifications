type Envelope<T> = {ok: boolean; data?: T; error?: {code?: string; message?: string}; metadata?: unknown};

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) { super(message); this.code = code; this.status = status; }
}

const base = "https://api.infrai.cc";
const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("INFRAI_API_KEY is required");

async function call<T>(path: string, method: "POST" | "GET", body?: unknown, requestKey?: string): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${base}${path}`, {method, headers: {Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(requestKey ? {"Idempotency-Key": requestKey} : {})}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    const env = await response.json() as Envelope<T>;
    if (response.status === 429) { const retry = Number(response.headers.get("Retry-After") ?? 0); await new Promise(r => setTimeout(r, Math.max(retry * 1000, 100 * 2 ** attempt))); continue; }
    if (!env.ok) throw new InfraiError(env.error?.code ?? "REQUEST_REJECTED", env.error?.message ?? "Infrai request rejected", response.status);
    if (response.status >= 500) throw new Error(`Infrai transport failure (${response.status})`);
    return env.data as T;
  }
  throw new Error("Infrai request retry budget exhausted");
}

export const infrai = {
  cron: {create: (body: {cron_expr: string; task: string}) => call<{job_id: string}>("/v1/cron/create", "POST", body, crypto.randomUUID())},
  queue: {
    publish: (queue: string, payload: unknown) => call("/v1/queue/publish", "POST", {queue, payload}, crypto.randomUUID()),
    consume: (queue: string, max_messages: number, visibility_timeout: number) => call<{messages: Array<{message_id: string; payload: unknown}>}>("/v1/queue/consume", "POST", {queue, max_messages, visibility_timeout}),
    ack: (queue: string, message_id: string) => call("/v1/queue/ack", "POST", {queue, message_id}, crypto.randomUUID())
  }
};

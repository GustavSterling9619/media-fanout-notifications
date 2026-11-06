import {z} from "zod";
import {infrai} from "./infrai_client.js";

export const MediaEvent = z.object({assetId: z.string().min(1), creatorId: z.string().min(1), subscribers: z.array(z.string().url()).min(1), status: z.enum(["processed"]) });
export type MediaEvent = z.infer<typeof MediaEvent>;
const queue = process.env.INFRAI_QUEUE ?? "media-processing";

export async function registerProcessingJob(workerUrl: string) {
  return infrai.cron.create({cron_expr: "*/5 * * * *", task: workerUrl});
}

export async function fanOut(event: unknown) {
  const parsed = MediaEvent.parse(event);
  await Promise.all(parsed.subscribers.map((subscriber) => infrai.queue.publish(queue, JSON.stringify({assetId: parsed.assetId, creatorId: parsed.creatorId, subscriber, status: parsed.status}))));
  return {assetId: parsed.assetId, delivered: parsed.subscribers.length};
}

export async function drain(accept: (payload: unknown) => Promise<void>, limit = 10) {
  const result = await infrai.queue.consume(queue, limit, 30);
  for (const message of result.messages ?? []) {
    await accept(message.payload);
    await infrai.queue.ack(queue, message.message_id);
  }
  return result.messages ?? [];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = {assetId: "asset-42", creatorId: "creator-7", subscribers: ["https://example.com/hooks/a", "https://example.com/hooks/b"], status: "processed" as const};
  console.log(await fanOut(input));
}

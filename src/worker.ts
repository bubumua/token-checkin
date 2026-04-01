import type { Env } from "./types";
import { handleFetch } from "./routes";
import { runCheckins } from "./checkin";
import { buildTelegramReport, sendTelegramReport } from "./telegram";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleFetch(request, env);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          const result = await runCheckins(env);
          console.log("Scheduled checkin result:", JSON.stringify(result));

          try {
            const msg = buildTelegramReport(result);
            const tgResult = await sendTelegramReport(env, msg);
            if (tgResult.sent) {
              console.log("Scheduled checkin telegram report sent");
            } else {
              console.warn("Scheduled checkin telegram report skipped:", tgResult.reason);
            }
          } catch (error) {
            console.error("Scheduled telegram report failed:", error);
          }
        } catch (error) {
          console.error("Scheduled checkin failed:", error);
        }
      })(),
    );
  },
};

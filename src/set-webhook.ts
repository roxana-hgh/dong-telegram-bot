import { bot } from "@/bot";

const url = process.env.WEBHOOK_URL!; // https://<app>.onrender.com/webhook
(async () => {
  await bot.api.setWebhook(process.env.WEBHOOK_URL!, {
    secret_token: process.env.WEBHOOK_SECRET,
  });
  console.log("webhook set");
})();

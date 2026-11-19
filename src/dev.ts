import { bot } from "@/bot";

bot.catch((err) => console.error("bot error:", err));

console.log("starting...");
bot.start({ onStart: (me) => console.log(`@${me.username} is running`) })
  .catch((e) => console.error("start failed:", e));
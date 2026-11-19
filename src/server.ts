import express from "express";
import { webhookCallback } from "grammy";
import { bot } from "@/bot";

const app = express();
app.use(express.json());

app.get("/", (_req, res) => res.send("ok")); // health check

app.post(
  "/webhook",
  webhookCallback(bot, "express", {
    secretToken: process.env.WEBHOOK_SECRET,
  })
);

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`listening on ${port}`));
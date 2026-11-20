// src/types.ts
import type { Context } from "grammy";
import type { User } from "@/generated/prisma/client";
export type MyContext = Context & { user: User };
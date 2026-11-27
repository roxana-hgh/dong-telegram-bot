// src/ui/expenseCard.ts
// The expense "card": one screen used for creating AND editing an expense.
import { InlineKeyboard } from "grammy";
import { fa as t } from "@/texts/fa";
import { withNav } from "@/keyboards";
import type { OwnedTrip } from "@/services/access";
import type { Draft } from "@/services/state";

export function cardText(d: Draft, trip: OwnedTrip): string {
  const members = trip.group.members;
  const selected = members.filter((m) => d.participants?.includes(m.id));
  return t.card({
    editing: !!d.expenseId,
    amount: d.amount,
    description: d.description,
    payer: members.find((m) => m.id === d.paidBy)?.displayName ?? "—",
    participants: selected.map((m) => m.displayName),
    everyone: selected.length === members.length,
  });
}

export function cardKb(d: Draft, trip: OwnedTrip): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text(d.expenseId ? t.btn.saveEdit : t.btn.save, "ex:save")
    .row()
    .text(t.btn.fAmount, "ex:f:amount")
    .text(t.btn.fDesc, "ex:f:desc")
    .row()
    .text(t.btn.fPayer, "ex:f:payer")
    .text(t.btn.fSplit, "ex:f:split");
  return withNav(kb, d.expenseId ? `e:${d.expenseId}` : `t:${trip.id}`);
}

/** Keyboard under a text prompt: back goes to the card (editing a field) or to the trip (wizard) */
export const promptKb = (d: Draft, trip: OwnedTrip) =>
  withNav(new InlineKeyboard(), d.chain ? `t:${trip.id}` : "ex:card");

export const afterSaveKb = (tripId: number) =>
  withNav(
    new InlineKeyboard()
      .text(t.btn.newExpense, `t:${tripId}:exp`)
      .text(t.btn.report, `t:${tripId}:report`)
      .row()
      .text(t.btn.expenses, `t:${tripId}:list`),
    `t:${tripId}`
  );

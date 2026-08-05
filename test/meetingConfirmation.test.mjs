import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMeetingConfirmationReminderMessage,
  isMeetingConfirmationReminderEligible,
  meetingConfirmationReminderToIso,
  validateMeetingConfirmationReminder,
} from "../lib/meetingConfirmation.ts";

test("przypomnienie telefoniczne może zostać wysłane dokładnie w chwili kontaktu", () => {
  const now = new Date("2026-08-05T09:00:00.000Z");

  assert.equal(
    isMeetingConfirmationReminderEligible({
      eventType: "phone_call",
      eventAt: now.toISOString(),
      now,
    }),
    true
  );
});

test("krótkie opóźnienie harmonogramu nie gubi przypomnienia telefonicznego", () => {
  const now = new Date("2026-08-05T09:07:00.000Z");

  assert.equal(
    isMeetingConfirmationReminderEligible({
      eventType: "phone_call",
      eventAt: "2026-08-05T09:00:00.000Z",
      now,
    }),
    true
  );
  assert.equal(
    isMeetingConfirmationReminderEligible({
      eventType: "phone_call",
      eventAt: "2026-08-05T08:49:59.000Z",
      now,
    }),
    false
  );
});

test("przypomnienie o spotkaniu nie jest wysyłane po jego terminie", () => {
  const now = new Date("2026-08-05T09:00:00.000Z");

  assert.equal(
    isMeetingConfirmationReminderEligible({
      eventType: "meeting",
      eventAt: "2026-08-05T08:59:59.000Z",
      now,
    }),
    false
  );
});

test("nie wymaga terminu przypomnienia, gdy checkbox jest wyłączony", () => {
  assert.equal(
    validateMeetingConfirmationReminder({
      required: false,
      reminderAt: "",
      meetingAt: "",
    }),
    null
  );
  assert.equal(meetingConfirmationReminderToIso(false, ""), null);
});

test("przypomnienie musi być wcześniejsze niż spotkanie", () => {
  const meetingAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const reminderAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  assert.match(
    validateMeetingConfirmationReminder({
      required: true,
      reminderAt,
      meetingAt,
    }) || "",
    /przed spotkaniem/
  );
});

test("przypomnienie telefoniczne może przypadać dokładnie w chwili kontaktu", () => {
  const contactAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  assert.equal(
    validateMeetingConfirmationReminder({
      required: true,
      reminderAt: contactAt,
      meetingAt: contactAt,
      kind: "phone",
    }),
    null
  );
});

test("przypomnienie telefoniczne nie może przypadać po kontakcie", () => {
  const contactAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const reminderAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  assert.match(
    validateMeetingConfirmationReminder({
      required: true,
      reminderAt,
      meetingAt: contactAt,
      kind: "phone",
    }) || "",
    /po terminie ponownego kontaktu/
  );
});

test("przypomnienie o spotkaniu nadal nie może być równe terminowi spotkania", () => {
  const meetingAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  assert.match(
    validateMeetingConfirmationReminder({
      required: true,
      reminderAt: meetingAt,
      meetingAt,
      kind: "meeting",
    }) || "",
    /przed spotkaniem/
  );
});

test("poprawny termin jest konwertowany do ISO", () => {
  const meetingAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const reminderAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  assert.equal(
    validateMeetingConfirmationReminder({
      required: true,
      reminderAt,
      meetingAt,
    }),
    null
  );
  assert.equal(meetingConfirmationReminderToIso(true, reminderAt), reminderAt);
});

test("wiadomość Teams zawiera imię, klienta, termin i bezpieczny link", () => {
  const message = buildMeetingConfirmationReminderMessage({
    advisorName: "Jan Kowalski",
    clientName: "Firma <Test>",
    eventAt: "2026-08-15T08:30:00.000Z",
    eventUrl: "https://crm.ideasol.pl/event/abc?x=1&y=2",
  });

  assert.match(message, /Cześć <strong>Jan<\/strong>/);
  assert.match(message, /Firma &lt;Test&gt;/);
  assert.match(message, /15\.08\.2026/);
  assert.match(message, /10:30/);
  assert.match(message, /x=1&amp;y=2/);
  assert.match(message, /Otwórz kartę spotkania/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { getMetaLeadBoardChatId } from "../lib/metaLeadBoardNotification.ts";

test("IdeaTermo korzysta z własnego czatu, a IdeaSol z dotychczasowego", () => {
  const env = {
    MICROSOFT_TEAMS_BOARD_CHAT_ID: "ideasol-board",
    MICROSOFT_TEAMS_IDEATERMO_BOARD_CHAT_ID: "19:2f9ffa3bc9eb4b5ea93fc25fb3acb199@thread.v2",
  };
  assert.equal(getMetaLeadBoardChatId("ideatermo", env), env.MICROSOFT_TEAMS_IDEATERMO_BOARD_CHAT_ID);
  assert.equal(getMetaLeadBoardChatId("ideasol", env), "ideasol-board");
});

test("brak czatu IdeaTermo nie przekierowuje danych na czat IdeaSol", () => {
  for (const value of [undefined, "", "   "]) {
    assert.throws(() => getMetaLeadBoardChatId("ideatermo", {
      MICROSOFT_TEAMS_BOARD_CHAT_ID: "ideasol-board",
      MICROSOFT_TEAMS_IDEATERMO_BOARD_CHAT_ID: value,
    }), /MICROSOFT_TEAMS_IDEATERMO_BOARD_CHAT_ID/);
  }
});

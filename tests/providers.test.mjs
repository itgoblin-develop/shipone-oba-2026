import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  notionTasks,
  calendarEvents,
  connectGoogle,
  aiCall,
} = require("../desktop/providers.cjs");
const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
async function mockFetch(fn, run) {
  const original = globalThis.fetch;
  globalThis.fetch = fn;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}
test("Notion resolves database to data source and reports truncation", async () => {
  let calls = [];
  await mockFetch(
    async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1
        ? response({ data_sources: [{ id: "source-id" }] })
        : response({
            has_more: true,
            results: [
              {
                id: "page-id",
                url: "https://www.notion.so/page-id",
                properties: {
                  Name: {
                    type: "title",
                    title: [{ plain_text: "문서 마무리" }],
                  },
                  Status: { type: "status", status: { name: "완료" } },
                  Minutes: { type: "number", number: 45 },
                  Due: { type: "date", date: { start: "2026-11-07" } },
                },
              },
            ],
          });
    },
    async () => {
      const r = await notionTasks(
        { notionToken: "test-token" },
        "a".repeat(32),
      );
      assert.equal(r.tasks[0].title, "문서 마무리");
      assert.equal(r.tasks[0].minutes, 45);
      assert.equal(r.tasks[0].done, true);
      assert.equal(r.truncated, true);
      assert.match(calls[1].url, /data_sources\/source-id\/query$/);
      assert.equal(calls[1].options.headers["Notion-Version"], "2025-09-03");
    },
  );
});
test("Calendar excludes transparent and cancelled events and preserves all-day occupancy", async () => {
  await mockFetch(
    async () =>
      response({
        items: [
          {
            id: "busy",
            summary: "회의",
            start: { dateTime: "2026-11-07T13:00:00+09:00" },
            end: { dateTime: "2026-11-07T14:00:00+09:00" },
          },
          { id: "free", transparency: "transparent" },
          { id: "cancel", status: "cancelled" },
          {
            id: "day",
            start: { date: "2026-11-07" },
            end: { date: "2026-11-08" },
          },
        ],
      }),
    async () => {
      const r = await calendarEvents(
        {
          googleTokens: {
            access_token: "test",
            expires_at: Date.now() + 3600000,
          },
        },
        {},
        () => {
          throw Error("Unexpected refresh");
        },
      );
      assert.equal(r.events.length, 2);
      assert.equal(r.events[0].source, "google");
      assert.equal(
        +new Date(r.events[1].end) - +new Date(r.events[1].start),
        86400000,
      );
    },
  );
});
test("Calendar refresh persists replacement access token and keeps refresh token", async () => {
  let count = 0,
    saved;
  await mockFetch(
    async () =>
      ++count === 1
        ? response({ access_token: "new-test", expires_in: 3600 })
        : response({ items: [] }),
    async () => {
      await calendarEvents(
        {
          googleTokens: {
            access_token: "old-test",
            refresh_token: "refresh-test",
            expires_at: 0,
          },
        },
        { googleClientId: "test" },
        (t) => {
          saved = t;
        },
      );
      assert.equal(saved.access_token, "new-test");
      assert.equal(saved.refresh_token, "refresh-test");
      assert.equal(count, 2);
    },
  );
});
test("Calendar rejects pagination instead of suggesting time from incomplete events", async () => {
  await mockFetch(
    async () => response({ items: [], nextPageToken: "more" }),
    async () => {
      await assert.rejects(
        () =>
          calendarEvents(
            {
              googleTokens: {
                access_token: "test",
                expires_at: Date.now() + 3600000,
              },
            },
            {},
            () => {},
          ),
        /250/,
      );
    },
  );
});
test("OpenAI rate limit and incomplete replies are explicit failures", async () => {
  await mockFetch(
    async () => response({ error: { message: "limit" } }, 429),
    async () => {
      await assert.rejects(
        () => aiCall({ openaiKey: "test" }, "gpt-4.1-mini", "plan", {}),
        /크레딧/,
      );
    },
  );
  await mockFetch(
    async () => response({ status: "incomplete", output: [] }),
    async () => {
      await assert.rejects(
        () => aiCall({ openaiKey: "test" }, "gpt-4.1-mini", "plan", {}),
        /끝까지/,
      );
    },
  );
});
test(
  "Desktop OAuth uses PKCE and validates state before accepting cancellation",
  { timeout: 5000 },
  async () => {
    await assert.rejects(
      () =>
        connectGoogle({ googleClientId: "test-client" }, async (raw) => {
          const auth = new URL(raw);
          assert.equal(auth.searchParams.get("code_challenge_method"), "S256");
          assert.equal(
            auth.searchParams.get("scope"),
            "https://www.googleapis.com/auth/calendar.events.readonly",
          );
          assert.ok(auth.searchParams.get("code_challenge").length > 30);
          const callback = new URL(auth.searchParams.get("redirect_uri"));
          callback.searchParams.set("state", "wrong");
          callback.searchParams.set("error", "access_denied");
          const invalid = await fetch(callback);
          assert.equal(invalid.status, 400);
          callback.searchParams.set("state", auth.searchParams.get("state"));
          const cancelled = await fetch(callback);
          assert.equal(cancelled.status, 200);
        }),
      /취소/,
    );
  },
);

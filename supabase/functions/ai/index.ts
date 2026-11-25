// DetourLoop — AI Edge Function (Deno, Supabase).
// The only place the OpenAI key is used. Every task returns structured JSON.
// The model never supplies facts: coordinates, distances, hours, ratings come from the
// place data the client sends in, and the model may only *explain* or *narrate* them.
//
// POST /functions/v1/ai   { task: "explain_discoveries" | "replay_story" | "assistant", input: {...} }
// Auth: the caller's Supabase JWT (Authorization: Bearer <access_token>).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ── Structured output schemas ──────────────────────────────────────────────
const SCHEMAS: Record<string, { name: string; schema: Record<string, unknown> }> = {
  explain_discoveries: {
    name: "discovery_explanations",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["items"],
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["place_id", "why", "score"],
            properties: {
              place_id: { type: "string" },
              why: { type: "string", description: "One or two sentences, grounded only in the supplied tags and the traveller's interests." },
              score: { type: "number", description: "0-1 relevance to this traveller." },
            },
          },
        },
      },
    },
  },
  replay_story: {
    name: "replay_story",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["title", "story"],
      properties: {
        title: { type: "string" },
        story: { type: "string", description: "3-5 short paragraphs. Only events present in the trip data." },
      },
    },
  },
  assistant: {
    name: "guide_answer",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["answer", "place_ids"],
      properties: {
        answer: { type: "string" },
        place_ids: { type: "array", items: { type: "string" }, description: "Only ids from the supplied candidate list." },
      },
    },
  },
};

const SYSTEM: Record<string, string> = {
  explain_discoveries:
    "You are DetourLoop's discovery editor. For each candidate place, write why THIS traveller would enjoy it, " +
    "using only the supplied name, category, tags, distance and the traveller's interests. Never invent facts, " +
    "opening hours, prices, ratings, history or activities that are not in the tags. If little is known, say so briefly. " +
    "Score relevance 0-1. Return every place_id you were given.",
  replay_story:
    "You write a warm, factual travel recap in second person from the supplied trip data only: origin, stops in order, " +
    "dates, distances, captions and notes. Never invent activities, weather, food, people or feelings that are not in the data. " +
    "Do not mention anything the data does not contain.",
  assistant:
    "You are 'Your DetourLoop Guide'. Answer the traveller's question using only the candidate places supplied " +
    "(real map data near them). Recommend at most 4, by place_id. If none fit, say so honestly. " +
    "Never invent places, hours, ratings or distances; distances are given to you. Keep it short and friendly. " +
    "If the traveller may be driving, remind them to let a passenger handle the phone.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!OPENAI_KEY) return json({ error: "ai_not_configured" }, 503);

  // Authenticate the caller.
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: userData, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !userData.user) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  // Rate limit by plan (limits live in app_config so they can change without a deploy).
  const [{ data: profile }, { data: cfg }] = await Promise.all([
    admin.from("profiles").select("subscription_status").eq("id", userId).single(),
    admin.from("app_config").select("value").eq("key", "plans").single(),
  ]);
  const plan = (profile?.subscription_status ?? "free") as string;
  const limit = Number(cfg?.value?.[plan]?.ai_discoveries_per_day ?? 10);
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await admin.from("ai_usage").select("calls").eq("user_id", userId).eq("day", today).maybeSingle();
  if ((usage?.calls ?? 0) >= limit) return json({ error: "rate_limited", limit, plan }, 429);

  let body: { task?: string; input?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const task = body.task ?? "";
  if (!SCHEMAS[task]) return json({ error: "unknown_task" }, 400);
  const input = JSON.stringify(body.input ?? {});
  if (input.length > 60_000) return json({ error: "input_too_large" }, 413);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.6,
      messages: [
        { role: "system", content: SYSTEM[task] },
        { role: "user", content: input },
      ],
      response_format: { type: "json_schema", json_schema: { ...SCHEMAS[task], strict: true } },
    }),
  });

  if (!res.ok) {
    console.error("openai_error", res.status, await res.text());
    return json({ error: "ai_upstream_error" }, 502);
  }
  const out = await res.json();
  let parsed: unknown;
  try {
    parsed = JSON.parse(out.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return json({ error: "ai_bad_output" }, 502);
  }

  await admin.from("ai_usage").upsert({ user_id: userId, day: today, calls: (usage?.calls ?? 0) + 1 });
  return json({ ok: true, source: "ai", model: OPENAI_MODEL, result: parsed });
});

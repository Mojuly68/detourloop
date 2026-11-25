// DetourLoop — video render job intake (Deno, Supabase).
// Queues a TravelReplay video job. Rendering itself happens in an external worker
// (FFmpeg on a container, or a cloud renderer) that polls render_jobs, renders, uploads
// to storage and sets status='done' + output_url.
//
// If RENDER_WORKER_URL is not set, the job is recorded with status 'unavailable' so the
// app can say honestly that video rendering is not set up. Nothing is ever marked 'done'
// here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKER_URL = Deno.env.get("RENDER_WORKER_URL");
const WORKER_SECRET = Deno.env.get("RENDER_WORKER_SECRET");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const TEMPLATES = ["cinematic", "adventure", "minimalist", "documentary", "social"];
const ASPECTS = ["16:9", "9:16", "1:1"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "") ?? "";
  const { data: u } = await admin.auth.getUser(jwt);
  if (!u.user) return json({ error: "unauthorized" }, 401);

  const { replay_id, template, aspect } = await req.json().catch(() => ({}));
  if (!TEMPLATES.includes(template) || !ASPECTS.includes(aspect)) return json({ error: "bad_request" }, 400);

  const { data: replay } = await admin.from("replays").select("id,user_id").eq("id", replay_id).single();
  if (!replay || replay.user_id !== u.user.id) return json({ error: "not_found" }, 404);

  const status = WORKER_URL ? "queued" : "unavailable";
  const { data: job, error } = await admin
    .from("render_jobs")
    .insert({ replay_id, user_id: u.user.id, template, aspect, status, error: WORKER_URL ? null : "render_worker_not_configured" })
    .select()
    .single();
  if (error) return json({ error: "db_error" }, 500);

  if (WORKER_URL) {
    // Fire-and-forget wake-up; the worker reads the job row itself.
    fetch(WORKER_URL, { method: "POST", headers: { "X-Render-Secret": WORKER_SECRET ?? "" }, body: JSON.stringify({ job_id: job.id }) }).catch(() => {});
  }
  return json({ job });
});

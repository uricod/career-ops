import { getCommunityMembership } from "@/lib/community/supabase-server";
import { runHostedSearch } from "@/lib/community/hosted-scanner";
import type { HostedSearchEvent } from "@/lib/community/job-search";
import { isSameOriginMutation } from "@/lib/community/security.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!isSameOriginMutation(request))
    return Response.json(
      { error: "Request origin rejected." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const query = String(body.query ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const location = String(body.location ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const sinceDays = Math.max(1, Math.min(60, Math.round(Number(body.sinceDays) || 30)));
  if (query.length < 2)
    return Response.json(
      { error: "Add a role, title, or skill to search for." },
      { status: 400 },
    );

  const { supabase, user, active } = await getCommunityMembership();
  if (!user)
    return Response.json({ error: "Sign in required." }, { status: 401 });
  if (!active)
    return Response.json({ error: "Active invitation required." }, { status: 403 });
  const { data: claimed, error: claimError } = await supabase!.rpc(
    "claim_job_search",
    { p_min_interval_seconds: 15 },
  );
  if (claimError)
    return Response.json(
      { error: "Search capacity is temporarily unavailable." },
      { status: 503 },
    );
  if (!claimed)
    return Response.json(
      { error: "A search just ran. Wait a few seconds before starting another." },
      { status: 429 },
    );

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (event: HostedSearchEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };
      try {
        const summary = await runHostedSearch(
          { query, location, sinceDays },
          emit,
        );
        emit({
          kind: "done",
          resultCount: summary.results.length,
          boardsChecked: summary.boardsChecked,
          failedBoards: summary.failedBoards,
          tokens: 0,
        });
      } catch {
        emit({
          kind: "warning",
          source: "search",
          message: "The search stopped early. Results already shown are still usable.",
        });
        emit({
          kind: "done",
          resultCount: 0,
          boardsChecked: 0,
          failedBoards: 0,
          tokens: 0,
        });
      } finally {
        if (!closed) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

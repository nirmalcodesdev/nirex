/**
 * useAutoMarkAsRead
 *
 * Production-grade auto-read pipeline. Notifications are flagged "read"
 * once they have been continuously visible in the viewport for
 * `DWELL_MS` (the user has had time to actually see them). Visible-but-
 * fleeting items (a fast scroll) do not get marked read.
 *
 * The pipeline is:
 *   1. `observe(el, id)`           — register an unread row's element
 *   2. IntersectionObserver fires  — start / cancel a dwell timer
 *   3. After DWELL_MS              — id is queued into the batch
 *   4. After BATCH_FLUSH_MS quiet  — fire one `PATCH /notifications/read`
 *                                    with all queued ids (optimistic UI)
 *   5. On unmount / sign-out       — flush whatever is queued
 *
 * The hook is mount-once: a single observer instance per page. Rows
 * pass their DOM node + id through `observe(el, id)` (a callback ref).
 * Already-read items are skipped at registration time so we never queue
 * a redundant write.
 *
 * Visibility is also gated by the Page Visibility API — backgrounded
 * tabs do not auto-mark, which matches the "user has seen them" intent.
 */

import { useCallback, useEffect, useRef } from "react";
import { useMarkNotificationsBatchReadMutation } from "../notifications/useNotifications";

const DWELL_MS = 1_500;
const BATCH_FLUSH_MS = 800;
const VISIBLE_INTERSECTION_RATIO = 0.6;
const MAX_BATCH = 200;

interface TrackingEntry {
  id: string;
  el: Element;
  dwellTimer: ReturnType<typeof setTimeout> | null;
}

export interface AutoMarkAsReadHandle {
  /** Callback-ref style: pass the row element + id. Returns void. */
  observe: (el: Element | null, id: string, isUnread: boolean) => void;
  /** Force-flush the pending queue (e.g. on dropdown close). */
  flush: () => void;
}

export function useAutoMarkAsRead(): AutoMarkAsReadHandle {
  const mutation = useMarkNotificationsBatchReadMutation();
  const mutateRef = useRef(mutation.mutate);
  useEffect(() => {
    mutateRef.current = mutation.mutate;
  }, [mutation.mutate]);

  // Element → tracking metadata. We key on the DOM node so the same row
  // re-mounting at a different position is treated as a fresh observation.
  const trackedRef = useRef<Map<Element, TrackingEntry>>(new Map());
  // ids waiting to be flushed to the server.
  const pendingIdsRef = useRef<Set<string>>(new Set());
  // ids already flushed in this session — guards against re-queueing the
  // same id if a row remounts after the optimistic cache update.
  const sentIdsRef = useRef<Set<string>>(new Set());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Self-reference indirection — lets the flush body schedule a follow-up
  // flush without directly closing over its own (still-being-declared)
  // function expression.
  const flushRef = useRef<() => void>(() => {});

  const flush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (pendingIdsRef.current.size === 0) return;

    // Pull out at most MAX_BATCH ids; whatever remains stays queued.
    const ids: string[] = [];
    for (const id of pendingIdsRef.current) {
      ids.push(id);
      pendingIdsRef.current.delete(id);
      if (ids.length >= MAX_BATCH) break;
    }
    for (const id of ids) sentIdsRef.current.add(id);

    mutateRef.current(ids, {
      onError: () => {
        // Roll the "sent" tracking back so a future scroll-into-view can retry.
        for (const id of ids) sentIdsRef.current.delete(id);
      },
    });

    // If more queued up while we were assembling the batch, schedule a follow-up.
    if (pendingIdsRef.current.size > 0) {
      flushTimerRef.current = setTimeout(() => flushRef.current(), BATCH_FLUSH_MS);
    }
  }, []);
  // Mirror the latest `flush` into the ref so the recursive-flush
  // setTimeout (above) and the unmount cleanup (below) can call it
  // without participating in render-time deps.
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(flush, BATCH_FLUSH_MS);
  }, [flush]);

  const queue = useCallback(
    (id: string) => {
      if (sentIdsRef.current.has(id)) return;
      if (pendingIdsRef.current.has(id)) return;
      pendingIdsRef.current.add(id);
      scheduleFlush();
    },
    [scheduleFlush],
  );

  // Lazy-create the IntersectionObserver on first observe() call. We use
  // `document` as the root (viewport) — works for both the dropdown
  // (overlaying the viewport) and the full notifications page.
  const getObserver = useCallback((): IntersectionObserver => {
    if (observerRef.current) return observerRef.current;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Skip work when the tab is hidden — backgrounded users haven't
        // "seen" anything; we wait for them to focus the tab.
        if (typeof document !== "undefined" && document.hidden) return;

        for (const entry of entries) {
          const tracked = trackedRef.current.get(entry.target);
          if (!tracked) continue;

          if (entry.isIntersecting && entry.intersectionRatio >= VISIBLE_INTERSECTION_RATIO) {
            if (tracked.dwellTimer) continue; // already dwelling
            tracked.dwellTimer = setTimeout(() => {
              tracked.dwellTimer = null;
              queue(tracked.id);
            }, DWELL_MS);
          } else if (tracked.dwellTimer) {
            clearTimeout(tracked.dwellTimer);
            tracked.dwellTimer = null;
          }
        }
      },
      {
        // 0 = barely on-screen, VISIBLE_INTERSECTION_RATIO = "actually visible".
        // We register both so we get re-notified as the row crosses the
        // visibility threshold.
        threshold: [0, VISIBLE_INTERSECTION_RATIO],
      },
    );
    return observerRef.current;
  }, [queue]);

  const observe = useCallback(
    (el: Element | null, id: string, isUnread: boolean) => {
      // Detach: callers pass null when the element unmounts.
      if (!el) return;
      // Already-read rows or ids we've already sent: skip.
      if (!isUnread) return;
      if (sentIdsRef.current.has(id)) return;
      // Re-registering the same element is a no-op.
      if (trackedRef.current.has(el)) return;

      trackedRef.current.set(el, { id, el, dwellTimer: null });
      getObserver().observe(el);
    },
    [getObserver],
  );

  // Clean up dwell timers, flush anything pending, and tear down the
  // observer on unmount. The pending flush is best-effort — if the tab
  // is closing, the request may not survive, but that's acceptable
  // because the next page load will see the items still unread.
  useEffect(() => {
    // Snapshot refs at effect-setup time so the cleanup closure refers
    // to the exact instances it observed, not whatever may have been
    // swapped in later (ESLint react-hooks/exhaustive-deps).
    const tracked = trackedRef.current;
    const pending = pendingIdsRef.current;
    return () => {
      for (const entry of tracked.values()) {
        if (entry.dwellTimer) clearTimeout(entry.dwellTimer);
      }
      tracked.clear();
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      // Best-effort flush.
      if (pending.size > 0) flushRef.current();
    };
  }, []);

  // Re-emit pending events when the tab becomes visible again — a user
  // who left a tab open with notifications visible should have them
  // marked read when they come back, not next scroll.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (document.hidden) return;
      // Force a re-check of the currently observed elements: anything
      // that is in view *right now* should start its dwell timer fresh.
      // The cheapest way is to ask the observer to re-emit entries by
      // re-observing each tracked element.
      const obs = observerRef.current;
      if (!obs) return;
      for (const entry of trackedRef.current.values()) {
        obs.unobserve(entry.el);
        obs.observe(entry.el);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return { observe, flush };
}

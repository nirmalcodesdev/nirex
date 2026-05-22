/**
 * RealtimeContext — extracted so RealtimeProvider.tsx can stay a
 * component-only module (keeps Vite fast-refresh happy).
 */

import { createContext, useContext } from "react";

export type RealtimeStatus = "idle" | "connecting" | "connected" | "disconnected";

interface RealtimeContextValue {
  status: RealtimeStatus;
}

export const RealtimeContext = createContext<RealtimeContextValue>({ status: "idle" });

export function useRealtimeStatus(): RealtimeStatus {
  return useContext(RealtimeContext).status;
}

/**
 * RealtimeProvider
 *
 * Owns the Socket.IO connection lifecycle. The socket is opened when
 * the user becomes authenticated and torn down on sign-out. Surface
 * state (`status`) is derived during render — never set imperatively
 * inside the effect body — so reactive flow stays linear.
 *
 * Failsafe behaviour on reconnect: invalidate the notifications query
 * so any events missed while offline are backfilled by REST.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RealtimeChannel } from "@nirex/shared";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { refreshAuthSession } from "../auth/authSlice";
import { notificationsBaseQueryKey } from "../notifications/useNotifications";
import {
  connectSocket,
  destroySocket,
  disconnectSocket,
  getSocket,
} from "./socketClient";
import { RealtimeContext, type RealtimeStatus } from "./RealtimeContext";

type SocketStatus = "connecting" | "connected" | "disconnected";

interface RealtimeProviderProps {
  children: ReactNode;
}

export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const authStatus = useAppSelector((s) => s.auth.status);
  const userId = useAppSelector((s) => s.auth.user?.id ?? null);

  // Socket-side state only. Auth-side state is layered on during render.
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("disconnected");
  const refreshInFlight = useRef(false);

  const status: RealtimeStatus =
    authStatus !== "authenticated" || !userId ? "idle" : socketStatus;

  useEffect(() => {
    if (authStatus !== "authenticated" || !userId) {
      // No imperative setState here — derived `status` already reports "idle".
      disconnectSocket();
      return;
    }

    const socket = getSocket();

    const handleConnect = () => {
      setSocketStatus("connected");
      // Backfill anything missed while we were offline.
      void queryClient.invalidateQueries({ queryKey: notificationsBaseQueryKey });
    };

    const handleDisconnect = (reason: string) => {
      setSocketStatus("disconnected");
      if (
        (reason === "io server disconnect" || reason === "transport error") &&
        !refreshInFlight.current
      ) {
        refreshInFlight.current = true;
        void dispatch(refreshAuthSession()).finally(() => {
          refreshInFlight.current = false;
        });
      }
    };

    const handleConnectError = (err: Error) => {
      setSocketStatus("disconnected");
      if (err.message === "UNAUTHENTICATED" && !refreshInFlight.current) {
        refreshInFlight.current = true;
        void dispatch(refreshAuthSession()).finally(() => {
          refreshInFlight.current = false;
        });
      }
    };

    const handleAuthExpired = () => {
      if (refreshInFlight.current) return;
      refreshInFlight.current = true;
      void dispatch(refreshAuthSession()).finally(() => {
        refreshInFlight.current = false;
      });
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on(RealtimeChannel.AuthExpired, handleAuthExpired);

    // Kick off the connection — listeners above will move state forward.
    connectSocket();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off(RealtimeChannel.AuthExpired, handleAuthExpired);
    };
  }, [authStatus, userId, dispatch, queryClient]);

  // Hard sign-out: blow the singleton away so the next sign-in opens a
  // brand-new connection with whatever cookie the new user holds.
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      destroySocket();
    }
  }, [authStatus]);

  const value = useMemo(() => ({ status }), [status]);

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

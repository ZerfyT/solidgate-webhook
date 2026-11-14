import { useState, useRef, useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

const MAX_LOGS = 1200;

export function useLogStream() {
  const [logs, setLogs] = useState([]);
  const bufferRef = useRef([]);
  const rafIdRef = useRef(null);
  const idCounter = useRef(0);

  const flushBuffer = useCallback(() => {
    if (bufferRef.current.length === 0) {
      rafIdRef.current = null;
      return;
    }

    const itemsToAppend = bufferRef.current;
    bufferRef.current = [];
    rafIdRef.current = null;

    setLogs((prev) => {
      const merged = prev.concat(itemsToAppend);
      if (merged.length > MAX_LOGS) {
        return merged.slice(merged.length - MAX_LOGS);
      }
      return merged;
    });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(flushBuffer);
    }
  }, [flushBuffer]);

  const appendLog = useCallback((log) => {
    idCounter.current += 1;
    const entry = {
      id: Date.now() + "_" + idCounter.current,
      timestamp: new Date().toLocaleTimeString(),
      ...log,
    };
    bufferRef.current.push(entry);
    scheduleFlush();
  }, [scheduleFlush]);

  const clearLogs = useCallback(() => {
    bufferRef.current = [];
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setLogs([]);
  }, []);

  useEffect(() => {
    // Listen for Tunnelmole logs and categorize errors/system messages
    const unlistenTunnel = listen("tunnel-log", (event) => {
      let type = "tunnel";
      let content = event.payload;

      if (typeof content === "object" && content !== null) {
        type = content.type || "tunnel";
        content = content.content || "";
      } else if (typeof content === "string") {
        const lower = content.toLowerCase();
        if (
          content.startsWith("[ERROR]") ||
          lower.includes("error:") ||
          lower.includes("failed to") ||
          lower.includes("rate limit") ||
          lower.includes("limited to") ||
          lower.includes("exception:") ||
          lower.includes("fatal:")
        ) {
          type = "error";
        } else if (
          content.startsWith("[SYSTEM]") ||
          lower.includes("refreshing session") ||
          lower.includes("retrying")
        ) {
          type = "system";
        }
      }

      appendLog({
        type,
        content,
      });
    });

    // Listen for Webhook hits
    const unlistenWebhook = listen("webhook-received", (event) => {
      appendLog({
        type: "webhook",
        content: `[Webhook Received]: ${event.payload}`,
      });
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      unlistenTunnel.then((f) => f());
      unlistenWebhook.then((f) => f());
    };
  }, [appendLog]);

  return { logs, appendLog, clearLogs };
}

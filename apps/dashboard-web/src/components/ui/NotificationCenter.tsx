import { useEffect, useRef, useState } from "react";
import { BellIcon } from "../icons";
import { useToast } from "./Toast";

function formatWhen(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationCenter() {
  const { history, unreadCount, markAllRead, clearHistory } = useToast();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    markAllRead();
    const handlePointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open, markAllRead]);

  return (
    <div className="notify-center" ref={panelRef}>
      <button
        type="button"
        className="icon-button notify-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notification center"
        aria-expanded={open}
      >
        <BellIcon size="sm" />
        {unreadCount > 0 && <span className="notify-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {open && (
        <div className="notify-panel" role="dialog" aria-label="Recent notifications">
          <div className="notify-panel-head">
            <p className="notify-panel-title">Notifications</p>
            {history.length > 0 && (
              <button type="button" className="notify-clear-btn" onClick={clearHistory}>
                Clear
              </button>
            )}
          </div>
          <div className="notify-list">
            {history.length === 0 ? (
              <p className="notify-empty">No notifications yet. Actions across the dashboard appear here.</p>
            ) : (
              history.map((entry) => (
                <article key={entry.id} className={`notify-item notify-item-${entry.tone}`}>
                  <p className="notify-item-title">{entry.title}</p>
                  {entry.message && <p className="notify-item-message">{entry.message}</p>}
                  <p className="notify-item-time">{formatWhen(entry.createdAt)}</p>
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

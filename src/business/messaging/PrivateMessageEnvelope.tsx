import { useEffect, useState, type FormEvent } from "react";

import "./private-message.css";

type Message = {
  id: string;
  senderDisplayName: string;
  recipientDisplayName: string;
  channel: "STATION" | "EMAIL";
  title: string;
  body: string;
  deliveryStatus: string;
  read: boolean;
  createdAt: string;
};

type MessageTab = "inbox" | "sent" | "compose";

let pendingUnreadCount: Promise<number> | undefined;

function readUnreadCount(fresh = false): Promise<number> {
  if (!fresh && pendingUnreadCount) return pendingUnreadCount;
  const request = api<{ unreadCount: number }>(
    "/api/v1/messages/unread-count",
  ).then((value) => value.unreadCount);
  pendingUnreadCount = request;
  const clear = () => {
    if (pendingUnreadCount === request) pendingUnreadCount = undefined;
  };
  void request.then(clear, clear);
  return request;
}

export function PrivateMessageEnvelope() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<MessageTab>("inbox");
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [issue, setIssue] = useState("");

  const loadUnread = (fresh = false) =>
    readUnreadCount(fresh)
      .then(setUnread)
      .catch(() => undefined);

  const load = (next: "inbox" | "sent") => {
    setTab(next);
    setIssue("");
    api<Message[]>(`/api/v1/messages/${next}`)
      .then(setMessages)
      .catch(() => setIssue("站内信加载失败，请稍后重试。"));
  };

  useEffect(() => {
    void loadUnread();
    const timer = window.setInterval(() => void loadUnread(), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setIssue("");
    try {
      await api<Message>("/api/v1/messages", {
        method: "POST",
        body: {
          recipient: data.get("recipient"),
          channel: data.get("channel"),
          title: data.get("title"),
          body: data.get("body"),
          idempotencyKey: crypto.randomUUID(),
        },
      });
      form.reset();
      load("sent");
    } catch {
      setIssue("发送失败，请核对完整收件人和已验证邮箱后重试。");
    }
  };
  const markRead = async (message: Message) => {
    if (tab !== "inbox" || message.read) return;
    try {
      await api(`/api/v1/messages/${message.id}/read`, {
        method: "POST",
        body: {},
      });
      setMessages((items) =>
        items.map((item) =>
          item.id === message.id ? { ...item, read: true } : item,
        ),
      );
      void loadUnread(true);
    } catch {
      setIssue("消息状态更新失败，请重试。");
    }
  };

  return (
    <div className="private-message-entry">
      <button
        className={`platform-bell private-message-button${unread ? " is-unread" : ""}`}
        type="button"
        aria-label={`站内信，${unread}条未读`}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) load("inbox");
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 5h18v14H3zM3 7l9 7 9-7" />
        </svg>
        {unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}
      </button>
      {open && (
        <section
          className="private-message-panel"
          role="dialog"
          aria-label="站内信"
        >
          <header>
            <strong>站内信</strong>
            <button
              type="button"
              aria-label="关闭站内信"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
          </header>
          <nav aria-label="站内信功能">
            <button
              aria-pressed={tab === "inbox"}
              onClick={() => load("inbox")}
              type="button"
            >
              收件箱
            </button>
            <button
              aria-pressed={tab === "sent"}
              onClick={() => load("sent")}
              type="button"
            >
              已发送
            </button>
            <button
              aria-pressed={tab === "compose"}
              onClick={() => setTab("compose")}
              type="button"
            >
              写信
            </button>
          </nav>
          {tab === "compose" ? (
            <form
              onSubmit={(event) => {
                void submit(event);
              }}
            >
              <label>
                收件人
                <input
                  name="recipient"
                  placeholder="完整用户名、手机号或邮箱"
                  required
                />
              </label>
              <fieldset>
                <legend>发送方式</legend>
                <label>
                  <input
                    name="channel"
                    type="radio"
                    value="STATION"
                    defaultChecked
                  />
                  站内信
                </label>
                <label>
                  <input name="channel" type="radio" value="EMAIL" />
                  邮箱
                </label>
              </fieldset>
              <label>
                标题
                <input name="title" maxLength={200} required />
              </label>
              <label>
                正文
                <textarea name="body" maxLength={20_000} required />
              </label>
              <button type="submit">发送</button>
            </form>
          ) : (
            <div className="private-message-list">
              {messages.length ? (
                messages.map((message) => (
                  <button
                    className={message.read ? "is-read" : "is-unread"}
                    key={message.id}
                    type="button"
                    onClick={() => {
                      void markRead(message);
                    }}
                  >
                    <strong>{message.title}</strong>
                    <span>
                      {tab === "inbox"
                        ? message.senderDisplayName
                        : message.recipientDisplayName}{" "}
                      · {new Date(message.createdAt).toLocaleString("zh-CN")}
                    </span>
                    <p>{message.body}</p>
                    {message.channel === "EMAIL" && (
                      <small>邮件状态：{message.deliveryStatus}</small>
                    )}
                  </button>
                ))
              ) : (
                <p>暂无消息</p>
              )}
            </div>
          )}
          {issue && <p role="alert">{issue}</p>}
        </section>
      )}
    </div>
  );
}

async function api<T = unknown>(
  path: string,
  options?: { method: "POST"; body: unknown },
): Promise<T> {
  const token = document.cookie
    .split("; ")
    .find((value) => value.startsWith("XSRF-TOKEN="))
    ?.slice(11);
  const response = await fetch(path, {
    method: options?.method ?? "GET",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options
        ? {
            "Content-Type": "application/json",
            "X-XSRF-TOKEN": decodeURIComponent(token ?? ""),
          }
        : {}),
    },
    ...(options ? { body: JSON.stringify(options.body) } : {}),
  });
  if (!response.ok) throw new Error(String(response.status));
  return ((await response.json()) as { data: T }).data;
}

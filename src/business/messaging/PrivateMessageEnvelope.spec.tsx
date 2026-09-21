import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrivateMessageEnvelope } from "./PrivateMessageEnvelope";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PrivateMessageEnvelope", () => {
  it("coalesces the StrictMode mount read but reads again after a fresh mount", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { unreadCount: 0 } }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <StrictMode>
        <PrivateMessageEnvelope />
      </StrictMode>,
    );
    expect(
      await screen.findByRole("button", { name: "站内信，0条未读" }),
    ).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    cleanup();
    render(<PrivateMessageEnvelope />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("highlights unread messages and marks an opened inbox message as read", async () => {
    let unread = 1;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = requestUrl(input);
      const data = path.endsWith("unread-count")
        ? { unreadCount: unread }
        : path.endsWith("/read")
          ? ((unread = 0), { read: true })
          : [message(false)];
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<PrivateMessageEnvelope />);
    expect(
      await screen.findByRole("button", { name: "站内信，1条未读" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "站内信，1条未读" }));
    await user.click(await screen.findByRole("button", { name: /测试消息/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/messages/message-1/read",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(
      await screen.findByRole("button", { name: "站内信，0条未读" }),
    ).toBeVisible();
  });

  it("offers only station or email delivery and sends the exact recipient", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const path = requestUrl(input);
      const data = path.endsWith("unread-count")
        ? { unreadCount: 0 }
        : path.endsWith("/sent")
          ? []
          : message(true);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "request-1" });

    const user = userEvent.setup();
    render(<PrivateMessageEnvelope />);
    await user.click(
      await screen.findByRole("button", { name: "站内信，0条未读" }),
    );
    await user.click(screen.getByRole("button", { name: "写信" }));
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    await user.type(screen.getByLabelText("收件人"), "receiver@example.com");
    await user.click(screen.getByRole("radio", { name: "邮箱" }));
    await user.type(screen.getByLabelText("标题"), "通知");
    await user.type(screen.getByLabelText("正文"), "正文内容");
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/messages",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            recipient: "receiver@example.com",
            channel: "EMAIL",
            title: "通知",
            body: "正文内容",
            idempotencyKey: "request-1",
          }),
        }),
      ),
    );
  });
});

function message(read: boolean) {
  return {
    id: "message-1",
    senderDisplayName: "发送人",
    recipientDisplayName: "收件人",
    channel: "STATION",
    title: "测试消息",
    body: "消息正文",
    deliveryStatus: "SENT",
    read,
    createdAt: "2026-09-16T08:00:00Z",
  };
}

function requestUrl(input: RequestInfo | URL) {
  if (input instanceof URL) return input.href;
  return typeof input === "string" ? input : input.url;
}

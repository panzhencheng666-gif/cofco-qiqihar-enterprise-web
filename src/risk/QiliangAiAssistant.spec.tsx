import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as RealtimeApiClientModule from "@/platform/api/realtimeApiClient";
import { App } from "@/shared/enterprise-ui/RiskWorkspaceUi";
import { QiliangAiAssistant } from "./QiliangAiAssistant";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("@/platform/api/realtimeApiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof RealtimeApiClientModule>();
  return {
    ...actual,
    createRealtimeApiClient: () => ({ get: mocks.get, post: mocks.post }),
  };
});

beforeEach(() => {
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
    "11111111-2222-4333-8444-555555555555",
  );
  mocks.post.mockResolvedValue({
    requestId: "11111111-1111-1111-1111-111111111111",
    subjectId: "employee-1",
    status: "QUEUED",
    question: "玉米水分标准是什么？",
    createdAt: "2026-09-22T14:30:00Z",
  });
  mocks.get.mockResolvedValue({
    requestId: "11111111-1111-1111-1111-111111111111",
    subjectId: "employee-1",
    status: "ANSWERED",
    question: "玉米水分标准是什么？",
    mode: "FOUNDATION_RAG",
    knowledgeVersion: "2026-09-22.v1",
    modelReference: "Qwen3.8-27B local snapshot",
    answer: "GB 1353-2018表1规定商品玉米水分含量不高于14.0%。",
    citations: [
      {
        id: "GB1353-2018",
        title: "GB 1353-2018 玉米",
        url: "https://openstd.samr.gov.cn/example",
        searchedAt: "2026-09-27T16:30:00Z",
        sourceType: "PUBLIC_PAGE_EXCERPT",
      },
    ],
    limitations: ["基础检索模式，不代表专家资格。"],
    createdAt: "2026-09-22T14:30:00Z",
    completedAt: "2026-09-22T14:30:06Z",
  });
});

afterEach(() => {
  cleanup();
  mocks.get.mockReset();
  mocks.post.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function openCompanion() {
  fireEvent.click(screen.getByRole("button", { name: "打开齐粮AI小伙伴" }));
}

describe("QiliangAiAssistant", () => {
  it("sends a question for the default web and knowledge search", async () => {
    render(
      <App>
        <QiliangAiAssistant />
      </App>,
    );
    openCompanion();
    fireEvent.change(screen.getByLabelText("向齐粮AI助手提问"), {
      target: { value: "粮食储藏规范有哪些更新？" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送问题" }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "/api/v1/risk/assistant/questions",
        { question: "粮食储藏规范有哪些更新？" },
        expect.anything(),
      ),
    );
  });

  it("labels the model boundary and renders a grounded answer with citations", async () => {
    render(
      <App>
        <QiliangAiAssistant />
      </App>,
    );
    openCompanion();

    expect(screen.getByText("联网搜索与知识库")).toBeInTheDocument();
    expect(screen.getByText("本地运行 · 齐粮知识与治理")).toBeInTheDocument();
    expect(screen.queryByText(/Qwen3\.8-27B 底座/u)).not.toBeInTheDocument();
    expect(
      screen.getByText(/无可用来源时会明确标注模型通识回答/u),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("向齐粮AI助手提问"), {
      target: { value: "玉米水分标准是什么？" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送问题" }));

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        "/api/v1/risk/assistant/questions",
        { question: "玉米水分标准是什么？" },
        {
          headers: {
            "Idempotency-Key": "assistant-11111111-2222-4333-8444-555555555555",
          },
        },
      ),
    );
    expect(
      await screen.findByText(
        "GB 1353-2018表1规定商品玉米水分含量不高于14.0%。",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "GB 1353-2018 玉米" }),
    ).toHaveAttribute("href", "https://openstd.samr.gov.cn/example");
    expect(
      screen.getByText("公开网页片段 · 检索时间 2026-09-27T16:30:00Z"),
    ).toBeInTheDocument();
    expect(screen.getByText("知识版本 2026-09-22.v1")).toBeInTheDocument();
    expect(screen.queryByText(/Qwen3\.8/u)).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("img", { name: "齐粮 AI 小伙伴形象" }),
    ).toHaveLength(3);
  });

  it("distinguishes a news publish time from its search time", async () => {
    mocks.get.mockResolvedValue({
      requestId: "11111111-1111-1111-1111-111111111111",
      subjectId: "employee-1",
      status: "ANSWERED",
      question: "新闻线索",
      mode: "FOUNDATION_RAG",
      knowledgeVersion: "web-v1",
      modelReference: "local",
      answer: "仅找到新闻标题。",
      citations: [
        {
          id: "news-1",
          title: "新闻线索标题",
          url: "https://news.google.com/rss/articles/example",
          sourceType: "NEWS_HEADLINE",
          publishedAt: "2026-09-26T08:15:00Z",
          searchedAt: "2026-09-27T16:30:00Z",
        },
      ],
      limitations: ["未读取文章正文。"],
      createdAt: "2026-09-27T16:29:00Z",
      completedAt: "2026-09-27T16:30:00Z",
    });
    render(
      <App>
        <QiliangAiAssistant />
      </App>,
    );
    openCompanion();
    fireEvent.change(screen.getByLabelText("向齐粮AI助手提问"), {
      target: { value: "新闻线索" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送问题" }));
    expect(await screen.findByText("仅找到新闻标题。")).toBeInTheDocument();
    expect(
      screen.getByText(
        "新闻标题 · 发布时间 2026-09-26T08:15:00Z · 检索时间 2026-09-27T16:30:00Z",
      ),
    ).toBeInTheDocument();
  });

  it("shows product identity without pretending it was a cited model answer", async () => {
    mocks.get.mockResolvedValue({
      requestId: "11111111-1111-1111-1111-111111111111",
      subjectId: "employee-1",
      status: "ANSWERED",
      question: "你好，介绍一下自己",
      mode: "PRODUCT_IDENTITY",
      knowledgeVersion: "qiliang-product-identity.v1",
      modelReference: null,
      answer: "我是齐粮 AI 模型服务，尚未完成正式专家训练与模型晋级。",
      citations: [],
      limitations: ["产品身份说明由系统提供，未调用模型。"],
      createdAt: "2026-09-22T14:30:00Z",
      completedAt: "2026-09-22T14:30:00Z",
    });
    render(
      <App>
        <QiliangAiAssistant />
      </App>,
    );
    openCompanion();
    fireEvent.change(screen.getByLabelText("向齐粮AI助手提问"), {
      target: { value: "你好，介绍一下自己" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送问题" }));
    expect(
      await screen.findByText(/我是齐粮 AI 模型服务/u),
    ).toBeInTheDocument();
    expect(screen.getByText("产品身份说明 · 未调用模型")).toBeInTheDocument();
    expect(screen.queryByText(/模型引用/u)).not.toBeInTheDocument();
  });

  it("renders an already-completed identity response without a redundant poll", async () => {
    mocks.post.mockResolvedValue({
      requestId: "11111111-1111-1111-1111-111111111111",
      subjectId: "employee-1",
      status: "ANSWERED",
      question: "你是谁",
      mode: "PRODUCT_IDENTITY",
      answer: "我是齐粮 AI 模型服务。",
      citations: [],
      limitations: ["产品身份说明由系统提供，未调用模型。"],
      createdAt: "2026-09-22T14:30:00Z",
      completedAt: "2026-09-22T14:30:00Z",
    });
    render(
      <App>
        <QiliangAiAssistant />
      </App>,
    );
    openCompanion();
    fireEvent.change(screen.getByLabelText("向齐粮AI助手提问"), {
      target: { value: "你是谁" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送问题" }));
    expect(
      await screen.findByText("我是齐粮 AI 模型服务。"),
    ).toBeInTheDocument();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("continues polling the same request after a transient lookup failure", async () => {
    mocks.get.mockRejectedValueOnce(new Error("temporary connection loss"));
    render(
      <App>
        <QiliangAiAssistant />
      </App>,
    );
    openCompanion();
    fireEvent.change(screen.getByLabelText("向齐粮AI助手提问"), {
      target: { value: "玉米水分标准是什么？" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送问题" }));

    fireEvent.click(
      await screen.findByRole("button", { name: "继续查询原问题结果" }),
    );

    expect(
      await screen.findByText(
        "GB 1353-2018表1规定商品玉米水分含量不高于14.0%。",
      ),
    ).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.get).toHaveBeenNthCalledWith(
      2,
      "/api/v1/risk/assistant/questions/11111111-1111-1111-1111-111111111111",
    );
  });

  it("turns browser speech into editable text and waits for explicit send", () => {
    const instances: MockRecognition[] = [];
    class MockRecognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult = null;
      onerror = null;
      onend = null;
      stop = vi.fn();
      start = vi.fn();
      constructor() {
        instances.push(this);
      }
    }
    vi.stubGlobal("SpeechRecognition", MockRecognition);
    render(
      <App>
        <QiliangAiAssistant />
      </App>,
    );
    openCompanion();
    fireEvent.click(screen.getByRole("button", { name: "开始语音输入" }));
    expect(instances).toHaveLength(1);
    const current = instances[0] as {
      lang: string;
      onresult:
        | ((event: {
            results: ArrayLike<ArrayLike<{ transcript: string }>>;
          }) => void)
        | null;
      stop: ReturnType<typeof vi.fn>;
    };
    expect(current.lang).toBe("zh-CN");
    act(() =>
      current.onresult?.({ results: [[{ transcript: "查询粮食质量" }]] }),
    );
    expect(screen.getByLabelText("向齐粮AI助手提问")).toHaveValue(
      "查询粮食质量",
    );
    expect(mocks.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "停止语音输入" }));
    expect(current.stop).toHaveBeenCalledOnce();
  });

  it("keeps text entry available when speech recognition is missing", () => {
    render(
      <App>
        <QiliangAiAssistant />
      </App>,
    );
    openCompanion();
    fireEvent.click(screen.getByRole("button", { name: "开始语音输入" }));
    expect(
      screen.getByText("当前浏览器不支持语音转文字，请使用文字输入。"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("向齐粮AI助手提问")).toBeEnabled();
  });
});

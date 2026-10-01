import {
  Alert,
  AudioOutlined,
  BookOutlined,
  Button,
  CloseOutlined,
  Input,
  SafetyCertificateOutlined,
  SendOutlined,
  Spin,
  Tag,
} from "@/shared/enterprise-ui/RiskWorkspaceUi";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRealtimeApiClient,
  RealtimeApiError,
} from "@/platform/api/realtimeApiClient";

interface Citation {
  id: string;
  title: string;
  url?: string;
  searchedAt?: string;
  publishedAt?: string;
  sourceType?: "SEARCH_SNIPPET" | "PUBLIC_PAGE_EXCERPT" | "NEWS_HEADLINE";
}

interface AssistantRequest {
  requestId: string;
  subjectId: string;
  status:
    "QUEUED" | "RUNNING" | "ANSWERED" | "INSUFFICIENT_EVIDENCE" | "FAILED";
  question: string;
  mode?: "FOUNDATION_RAG" | "FOUNDATION_GENERAL" | "PRODUCT_IDENTITY";
  knowledgeVersion?: string;
  modelReference?: string;
  answer?: string;
  citations?: readonly Citation[];
  limitations?: readonly string[];
  failureCode?: string;
  createdAt: string;
  completedAt?: string;
}

interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechErrorEvent {
  error: string;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

const api = createRealtimeApiClient();
const terminal = new Set(["ANSWERED", "INSUFFICIENT_EVIDENCE", "FAILED"]);
const webSearchPrefix = "[联网搜索] ";

function safeCitationUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function citationTypeLabel(value?: Citation["sourceType"]): string {
  if (value === "NEWS_HEADLINE") return "新闻标题";
  if (value === "PUBLIC_PAGE_EXCERPT") return "公开网页片段";
  if (value === "SEARCH_SNIPPET") return "搜索摘要";
  return "来源";
}

function assistantError(error: unknown): string {
  if (error instanceof Error && error.message === "assistant polling timeout") {
    return "等待答案超时，原问题可能仍在处理。可继续查询结果。";
  }
  if (error instanceof RealtimeApiError) {
    if (error.status === 503) return "齐粮AI节点暂时繁忙，请稍后重试。";
    if (error.status === 403) return "当前账号没有齐粮AI助手访问权限。";
    return error.clientMessage ?? "齐粮AI助手请求失败，请稍后重试。";
  }
  return "齐粮AI助手请求失败，请稍后重试。";
}

function QiliangAssistantMark() {
  return (
    <svg
      className="qiliang-assistant-mark"
      viewBox="0 0 96 112"
      role="img"
      aria-label="齐粮 AI 小伙伴形象"
    >
      <ellipse cx="48" cy="106" rx="30" ry="5" fill="#124b45" opacity=".16" />
      <path d="M39 29C28 15 33 5 47 3c-2 10-3 18-8 26Z" fill="#7cac58" />
      <path d="M50 30C50 15 57 8 71 10c-7 10-12 16-21 20Z" fill="#d7aa46" />
      <path
        d="M46 29c2-10 4-16 8-22"
        fill="none"
        stroke="#357568"
        strokeWidth="2"
      />
      <path
        d="M23 42c-4-3-11-1-12 6-2 7 2 12 7 14M73 42c4-3 11-1 12 6 2 7-2 12-7 14"
        fill="none"
        stroke="#0e665b"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <rect x="20" y="24" width="56" height="69" rx="27" fill="#0d6c60" />
      <path d="M29 70c8 8 30 9 39 0v10c-8 11-30 12-39 0Z" fill="#07564d" />
      <rect x="26" y="31" width="44" height="45" rx="21" fill="#fff8e9" />
      <ellipse cx="38" cy="52" rx="3" ry="4" fill="#174843" />
      <ellipse cx="58" cy="52" rx="3" ry="4" fill="#174843" />
      <path
        d="M43 63c3 3 7 3 10 0"
        fill="none"
        stroke="#b66f4e"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="31" cy="61" r="4" fill="#f3b9a3" opacity=".7" />
      <circle cx="65" cy="61" r="4" fill="#f3b9a3" opacity=".7" />
      <path
        d="M38 90v8m20-8v8"
        stroke="#0c6157"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path
        d="M32 42c7-6 25-8 32-2"
        fill="none"
        stroke="#e1bc69"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function QiliangAiAssistant({
  open,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const isOpen = open ?? ownOpen;
  const changeOpen = useCallback(
    (next: boolean) => {
      if (open === undefined) setOwnOpen(next);
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );
  const [question, setQuestion] = useState("");
  const [request, setRequest] = useState<AssistantRequest | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recognition = useRef<BrowserSpeechRecognition | null>(null);
  const stopped = useRef(false);
  const pollingDelay = useRef<{
    timer: number;
    resolve: () => void;
  } | null>(null);

  useEffect(() => {
    stopped.current = false;
    return () => {
      stopped.current = true;
      recognition.current?.stop();
      if (pollingDelay.current) {
        window.clearTimeout(pollingDelay.current.timer);
        pollingDelay.current.resolve();
        pollingDelay.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) return;
    recognition.current?.stop();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") changeOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, changeOpen]);

  function toggleVoice() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const browser = window as SpeechWindow;
    const Constructor =
      browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) {
      setVoiceError("当前浏览器不支持语音转文字，请使用文字输入。");
      return;
    }
    setVoiceError(null);
    try {
      const current = new Constructor();
      current.lang = "zh-CN";
      current.continuous = false;
      current.interimResults = false;
      current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join("")
          .trim();
        if (transcript)
          setQuestion((previous) =>
            [previous, transcript].filter(Boolean).join(" ").slice(0, 2000),
          );
      };
      current.onerror = (event) => {
        setVoiceError(
          event.error === "not-allowed"
            ? "麦克风权限未开启，请允许浏览器访问麦克风，或改用文字输入。"
            : "语音识别未完成，请重试或改用文字输入。",
        );
      };
      current.onend = () => {
        setListening(false);
        if (recognition.current === current) recognition.current = null;
      };
      recognition.current = current;
      current.start();
      setListening(true);
    } catch {
      recognition.current = null;
      setListening(false);
      setVoiceError("无法启动语音识别，请改用文字输入。");
    }
  }

  async function waitBeforePolling() {
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        pollingDelay.current = null;
        resolve();
      }, 1_000);
      pollingDelay.current = { timer, resolve };
    });
  }

  async function waitForAnswer(requestId: string) {
    for (let attempt = 0; attempt < 120 && !stopped.current; attempt += 1) {
      const current = await api.get<AssistantRequest>(
        `/api/v1/risk/assistant/questions/${requestId}`,
      );
      if (stopped.current) return;
      setRequest(current);
      if (terminal.has(current.status)) return;
      await waitBeforePolling();
    }
    if (!stopped.current) throw new Error("assistant polling timeout");
  }

  async function submit() {
    const value = question.trim();
    if (!value || working) return;
    const submittedQuestion = value;
    if (submittedQuestion.length > 2000) {
      setError("问题不能超过 2000 个字符。");
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const queued = await api.post<AssistantRequest>(
        "/api/v1/risk/assistant/questions",
        { question: submittedQuestion },
        {
          headers: {
            "Idempotency-Key": `assistant-${globalThis.crypto.randomUUID()}`,
          },
        },
      );
      setRequest(queued);
      setQuestion("");
      if (!terminal.has(queued.status)) await waitForAnswer(queued.requestId);
    } catch (submitError) {
      if (!stopped.current) setError(assistantError(submitError));
    } finally {
      if (!stopped.current) setWorking(false);
    }
  }

  async function resume() {
    if (!request || terminal.has(request.status) || working) return;
    setWorking(true);
    setError(null);
    try {
      await waitForAnswer(request.requestId);
    } catch (pollError) {
      if (!stopped.current) setError(assistantError(pollError));
    } finally {
      if (!stopped.current) setWorking(false);
    }
  }

  return (
    <div className="qiliang-assistant-companion">
      <button
        type="button"
        className="qiliang-companion-trigger"
        aria-label={isOpen ? "收起齐粮AI小伙伴" : "打开齐粮AI小伙伴"}
        aria-expanded={isOpen}
        aria-controls="qiliang-companion-panel"
        onClick={() => changeOpen(!isOpen)}
      >
        <QiliangAssistantMark />
        <span>问问齐粮</span>
      </button>
      {isOpen && (
        <aside
          id="qiliang-companion-panel"
          className="qiliang-assistant"
          role="dialog"
          aria-label="齐粮AI小伙伴聊天"
        >
          <section
            className="qiliang-assistant-boundary"
            aria-label="齐粮AI助手能力边界"
          >
            <QiliangAssistantMark />
            <div>
              <strong>齐粮 AI 助手</strong>
              <span>本地运行 · 齐粮知识与治理</span>
            </div>
            <Tag color="cyan">联网搜索与知识库</Tag>
            <small>
              默认联网检索并结合知识库作答；无可用来源时会明确标注模型通识回答。
            </small>
            <button
              type="button"
              className="qiliang-companion-close"
              aria-label="关闭齐粮AI小伙伴"
              onClick={() => changeOpen(false)}
            >
              <CloseOutlined />
            </button>
          </section>

          {error && <Alert type="error" showIcon message={error} />}
          {error && request && !terminal.has(request.status) && !working && (
            <Button
              onClick={() => void resume()}
              aria-label="继续查询原问题结果"
            >
              继续查询原问题结果
            </Button>
          )}
          {voiceError && <Alert type="warning" showIcon message={voiceError} />}

          <section
            className="qiliang-assistant-dialog"
            aria-label="齐粮AI助手对话"
          >
            {!request && (
              <div className="qiliang-assistant-empty">
                <BookOutlined />
                <strong>搜索互联网与齐粮知识库</strong>
                <p>
                  可以询问粮食质量、储藏、市场监测和风险案例；回答会区分可核验来源与模型通识。
                </p>
              </div>
            )}
            {request && (
              <div className="qiliang-assistant-thread">
                <article className="is-user">
                  <span>你</span>
                  <p>
                    {request.question.startsWith(webSearchPrefix)
                      ? request.question.slice(webSearchPrefix.length)
                      : request.question}
                  </p>
                </article>
                <article className="is-assistant">
                  <span>
                    <QiliangAssistantMark /> 齐粮AI助手
                  </span>
                  {terminal.has(request.status) ? (
                    <>
                      <p>{request.answer ?? "本次回答未生成，请稍后重试。"}</p>
                      {!!request.citations?.length && (
                        <div className="qiliang-assistant-citations">
                          <strong>引用依据</strong>
                          {request.citations.map((citation) => {
                            const url = safeCitationUrl(citation.url);
                            const timeDetails = [
                              citation.publishedAt &&
                                `发布时间 ${citation.publishedAt}`,
                              citation.searchedAt &&
                                `检索时间 ${citation.searchedAt}`,
                            ].filter(Boolean);
                            return (
                              <div key={citation.id}>
                                {url ? (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    {citation.title}
                                  </a>
                                ) : (
                                  <span>{citation.title}</span>
                                )}
                                <small>
                                  {citationTypeLabel(citation.sourceType)} ·{" "}
                                  {timeDetails.length
                                    ? timeDetails.join(" · ")
                                    : "时间未返回"}
                                </small>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="qiliang-assistant-meta">
                        <SafetyCertificateOutlined />
                        {request.mode === "PRODUCT_IDENTITY" ? (
                          <span>产品身份说明 · 未调用模型</span>
                        ) : request.mode === "FOUNDATION_GENERAL" ? (
                          <span>齐粮基础模型通识回答 · 来源未核验</span>
                        ) : (
                          <>
                            <span>
                              知识版本 {request.knowledgeVersion ?? "未返回"}
                            </span>
                            <span>齐粮基础模型 + 检索</span>
                          </>
                        )}
                      </div>
                      {!!request.limitations?.length && (
                        <ul>
                          {request.limitations.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <div className="qiliang-assistant-working">
                      <Spin size="small" /> 正在调用私有齐粮AI节点…
                    </div>
                  )}
                </article>
              </div>
            )}
          </section>

          <section className="qiliang-assistant-composer">
            <p className="qiliang-assistant-web-search">
              提问会发送给公开搜索引擎；搜索资料记录来源，模型综合作答。
            </p>
            <Input.TextArea
              aria-label="向齐粮AI助手提问"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              maxLength={2000}
              autoSize={{ minRows: 2, maxRows: 5 }}
              placeholder="向齐粮AI助手提问；Shift + Enter 换行"
            />
            <Button
              icon={<AudioOutlined />}
              aria-label={listening ? "停止语音输入" : "开始语音输入"}
              aria-pressed={listening}
              onClick={toggleVoice}
            >
              {listening ? "停止录音" : "语音输入"}
            </Button>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={working}
              aria-label="发送问题"
              disabled={!question.trim()}
              onClick={() => void submit()}
            >
              发送问题
            </Button>
            <small className="qiliang-voice-note">
              语音由当前浏览器识别，转成文字后由你确认发送。
            </small>
          </section>
        </aside>
      )}
    </div>
  );
}

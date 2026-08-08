export interface EnterpriseNotice {
  id: string;
  title: string;
  detail: string;
  tone: "warning" | "danger" | "default";
}

export function EnterpriseNoticePanel({
  notices,
}: {
  notices: readonly EnterpriseNotice[];
}) {
  return (
    <section className="enterprise-work-panel enterprise-notice-panel">
      <header className="enterprise-panel-heading">
        <div>
          <h2>需要关注</h2>
          <p>仅列出会影响当前业务推进的事项。</p>
        </div>
      </header>
      <ul>
        {notices.map((notice, index) => (
          <li key={notice.id} data-tone={notice.tone}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{notice.title}</strong>
              <small>{notice.detail}</small>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

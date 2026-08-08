import { EnterprisePage } from "@/shared/enterprise-ui";

export function NotFoundPage() {
  return (
    <EnterprisePage
      eyebrow="导航提示"
      title="页面不存在"
      description="当前地址没有匹配的可访问业务页面，请从主导航进入。"
    >
      <section className="enterprise-work-panel">
        <p>该页面没有读取或修改任何业务数据。</p>
      </section>
    </EnterprisePage>
  );
}

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import viteConfiguration, { enterpriseApiProxy } from "../../vite.config";

function readWorkspaceFile(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("企业平台访问入口", () => {
  it("只保留 63182 根地址对应的正式企业平台入口", () => {
    const rootEntry = readWorkspaceFile("../../index.html");

    expect(rootEntry).toContain('<div id="enterprise-root"></div>');
    expect(rootEntry).toContain(
      '<script type="module" src="/src/enterprise/main.tsx"></script>',
    );
    expect(existsSync(resolve(process.cwd(), "prototype.html"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/prototype"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/business"))).toBe(true);
  });

  it("运行脚本不再声明原型入口或历史端口", () => {
    const packageSource = readWorkspaceFile("../../package.json");
    const packageJson = JSON.parse(packageSource) as {
      scripts: Record<string, string>;
    };

    expect(Object.keys(packageJson.scripts)).not.toContain("prototype");
    expect(Object.keys(packageJson.scripts)).not.toContain("build:prototype");
    expect(packageSource).not.toContain("64185");
  });

  it("标准测试入口包含企业身份补证脚本的原生 Node 回归", () => {
    const packageJson = JSON.parse(readWorkspaceFile("../../package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["stage3:idp-supplement:test"]).toBe(
      "node --test scripts/run-stage-three-idp-supplement.spec.mjs",
    );
    expect(packageJson.scripts["test"]).toContain(
      "npm run stage3:idp-supplement:test",
    );
  });

  it("生产构建不能用前端环境变量绕过同源登录和退出入口", () => {
    const applicationSource = readWorkspaceFile(
      "./EnterpriseBusinessApplication.tsx",
    );
    const apiClientSource = readWorkspaceFile(
      "../platform/api/realtimeApiClient.ts",
    );
    const repositorySource = readWorkspaceFile(
      "../platform/api/realtimeBusinessRepository.ts",
    );
    const environmentTypes = readWorkspaceFile("../vite-env.d.ts");

    expect(applicationSource).not.toContain("VITE_LOGIN_URL");
    expect(applicationSource).not.toContain("VITE_LOGOUT_URL");
    expect(apiClientSource).not.toContain("VITE_API_BASE_URL");
    expect(repositorySource).not.toContain("VITE_API_BASE_URL");
    expect(environmentTypes).not.toContain("VITE_LOGIN_URL");
    expect(environmentTypes).not.toContain("VITE_LOGOUT_URL");
    expect(environmentTypes).not.toContain("VITE_API_BASE_URL");
  });

  it("同源代理向后端传递原始入口信息以防登录跳转泄露内部端口", () => {
    expect(enterpriseApiProxy.changeOrigin).toBe(true);
    expect(enterpriseApiProxy.xfwd).toBe(true);

    const proxy = viteConfiguration.server?.proxy;
    expect(proxy).toHaveProperty("/api");
    expect(proxy).toHaveProperty("/oauth2");
    expect(proxy).toHaveProperty("/login/oauth2");
    expect(proxy).toHaveProperty("/logout/connect/back-channel");
  });
});

# Enterprise Visual Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a disposable, read-only, high-fidelity prototype that lets the user compare three structurally different enterprise UI directions across “我的工作、产情监测、市场监测、供需平衡”.

**Architecture:** Add an isolated Vite HTML entry that never joins the formal application router or data gateway. The prototype keeps all sample state in memory, renders three switchable layout variants from the same business content, and exposes page and variant selection through URL parameters for review.

**Tech Stack:** React 19, TypeScript 5.9, Vite 8, plain CSS, local Chinese system fonts.

## Global Constraints

- The prototype is explicitly marked “界面样板｜非正式数据” and must not claim to be a working production system.
- It does not connect to a database, API, authentication provider, export service, or formal calculation service.
- It must not modify the formal router, formal gateway, domain model, or production page components.
- Three structurally different variants are available through `?variant=A|B|C`.
- Four representative pages are available through `&page=work|production|market|supply`.
- The design uses navy `#0B2A3B`, teal `#167C74`, canvas `#F3F6F8`, white `#FFFFFF`, separator `#D6E0E6`, and amber `#B88318` as its shared base palette.
- The primary review viewport is 1440 × 900; the prototype must remain operable at 1024 px width.
- User-facing copy is Chinese business language. Technical IDs and software implementation terms do not appear in the business interface.
- Keyboard focus is visible, reduced-motion preferences are respected, and variant arrow keys do not intercept input fields.
- Per the prototype workflow, this throwaway artifact has no automated component test suite; verification is TypeScript compilation, isolated Vite build, and browser review.

## Design Direction

**Concrete subject:** A regional grain-monitoring operating console used by enterprise analysts, reviewers, and managers to turn production and market observations into traceable supply-demand decisions.

**Type roles:**

- Headings: `"Songti SC", "STSong"` for restrained editorial authority.
- Body and controls: `"PingFang SC", "Microsoft YaHei"` for dense operational readability.
- Figures and utility labels: `"DIN Alternate", "Arial Narrow", sans-serif` with tabular numerals.

**Signature:** A “责任与版本轨道” that reads from left to right as 责任组织 → 当前岗位 → 业务期间 → 数据截止 → 质量资格 → 审核状态 → 发布版本. It is business state, not decoration.

**Variants:**

- **A — 责任轨道型（推荐）:** stable left navigation, restrained title band, responsibility/version rail, central operating canvas, slim exception column. Best for frequent cross-domain work.
- **B — 对象台账型:** object index column, document-like central ledger, persistent right inspector. Best for deep review and audit.
- **C — 指挥调度型:** horizontal command header, wide situation strip, dense split workboard with no card-grid hero. Best for managers and large screens.

```text
A — 责任轨道型
┌────────────全局顶栏─────────────┐
├──────┬────────责任与版本轨道──────┤
│一级导航│ 页面标题 / 页面内导航        │
│      │ 主作业区             异常列  │
└──────┴─────────────────────────┘

B — 对象台账型
┌────────────轻量顶栏─────────────┐
├──对象索引──┬────正式台账正文────┬──检查器──┤
│业务与对象  │期间 / 指标 / 表格   │血缘与审核│
└─────────┴─────────────────┴───────┘

C — 指挥调度型
┌──────────指挥栏 / 模块切换─────────┐
├──────────态势与责任状态带───────────┤
│       主态势板       │ 处置与发布队列 │
├────────────────────────────────┤
│            业务明细工作板             │
└────────────────────────────────┘
```

## File Structure

- `prototype.html`: clearly labeled disposable HTML entry.
- `vite.prototype.config.ts`: isolated development port and isolated production output.
- `package.json`: one-command prototype start and build scripts.
- `src/prototype/main.tsx`: prototype-only React mount.
- `src/prototype/EnterpriseArchitecturePrototype.tsx`: in-memory state, page navigation, variant switching, and all three structural variants.
- `src/prototype/prototype.css`: complete token system, layouts, responsive behavior, focus treatment, and reduced motion.

---

### Task 1: Add the isolated prototype entry

**Files:**

- Create: `prototype.html`
- Create: `vite.prototype.config.ts`
- Modify: `package.json`
- Create: `src/prototype/main.tsx`

**Interfaces:**

- Consumes: React and Vite already pinned by the repository.
- Produces: `npm run prototype` at `http://127.0.0.1:63182/prototype.html` and `npm run build:prototype`.

- [ ] **Step 1: Add run scripts**

Add these exact scripts to `package.json`:

```json
{
  "prototype": "vite --config vite.prototype.config.ts",
  "build:prototype": "vite build --config vite.prototype.config.ts"
}
```

- [ ] **Step 2: Create the isolated HTML entry**

```html
<!doctype html>
<html lang="zh-CN" data-prototype="enterprise-architecture">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0b2a3b" />
    <title>齐齐哈尔粮情企业平台｜界面样板</title>
  </head>
  <body>
    <div id="prototype-root"></div>
    <script type="module" src="/src/prototype/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create the isolated Vite configuration**

```ts
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 63182, strictPort: true },
  build: {
    outDir: "dist-prototype",
    emptyOutDir: true,
    rollupOptions: { input: resolve(import.meta.dirname, "prototype.html") },
  },
});
```

- [ ] **Step 4: Mount the prototype**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { EnterpriseArchitecturePrototype } from "./EnterpriseArchitecturePrototype";
import "./prototype.css";

const mount = document.getElementById("prototype-root");
if (!mount) throw new Error("缺少界面样板挂载节点");

createRoot(mount).render(
  <StrictMode>
    <EnterpriseArchitecturePrototype />
  </StrictMode>,
);
```

- [ ] **Step 5: Verify the entry compiles after later component tasks**

Run: `npm run build:prototype`

Expected: Vite emits `dist-prototype/prototype.html` with no TypeScript or bundle error.

### Task 2: Build the page model and three structural variants

**Files:**

- Create: `src/prototype/EnterpriseArchitecturePrototype.tsx`

**Interfaces:**

- Consumes: `window.location.search`, browser history, and in-memory sample content.
- Produces: `EnterpriseArchitecturePrototype(): JSX.Element`.

- [ ] **Step 1: Define exact page and variant types**

```tsx
type PrototypePage = "work" | "production" | "market" | "supply";
type PrototypeVariant = "A" | "B" | "C";

interface PageDefinition {
  key: PrototypePage;
  label: string;
  eyebrow: string;
  title: string;
  summary: string;
}

const variants: readonly PrototypeVariant[] = ["A", "B", "C"];
const pages: readonly PageDefinition[] = [
  {
    key: "work",
    label: "我的工作",
    eyebrow: "今日履责",
    title: "经营监测工作台",
    summary: "先处理影响发布资格的任务与异常。",
  },
  {
    key: "production",
    label: "产情监测",
    eyebrow: "业务运营",
    title: "玉米产情监测",
    summary: "分来源治理种植生产、库存销售与种植意愿。",
  },
  {
    key: "market",
    label: "市场监测",
    eyebrow: "业务运营",
    title: "粮食市场监测",
    summary: "从报价与交易追踪到库存、加工和区域流向。",
  },
  {
    key: "supply",
    label: "供需平衡",
    eyebrow: "决策分析",
    title: "玉米供需账户",
    summary: "只使用已发布事实与指标生成可追溯账户。",
  },
];
```

- [ ] **Step 2: Implement URL-backed navigation**

Use `URLSearchParams` to read `variant` and `page`, normalize unsupported values to `A` and `work`, and update both the address bar and component state with `history.replaceState`.

- [ ] **Step 3: Implement the full-state prototype switcher**

Render the current variant name, current page label, previous and next arrow buttons, and a development-only notice. Add `ArrowLeft` and `ArrowRight` listeners that ignore `input`, `textarea`, and contenteditable targets.

- [ ] **Step 4: Implement Variant A**

Create a fixed enterprise header and left navigation. Render the responsibility/version rail immediately above the active page body. Use a dominant central work area and a narrow “需立即处理” column. Do not use a four-card KPI hero.

- [ ] **Step 5: Implement Variant B**

Use a three-pane ledger layout: business/object index, formal document body, and audit inspector. Keep the current page, period, source qualification, review state, and lineage visible without opening a modal.

- [ ] **Step 6: Implement Variant C**

Use a horizontal command bar, a compact situation strip, and a wide split workboard. Prioritize status, action, and publishing readiness over navigation chrome.

- [ ] **Step 7: Populate all four page bodies**

Each variant must support:

```text
我的工作：任务队列、影响发布的异常、完成时限、责任岗位、当前版本
产情监测：三类来源、区域覆盖、长势与产量判断、质量资格、发布进度
市场监测：报价与交易、库存与仓储、加工消费、物流流向、来源时间
供需平衡：供给项、使用项、期末库存、平衡差额、账户版本、血缘映射
```

All figures are labeled as sample data, use units consistently, and never claim that a button performs a backend mutation.

### Task 3: Apply the distinctive enterprise visual system

**Files:**

- Create: `src/prototype/prototype.css`

**Interfaces:**

- Consumes: semantic `prototype-*` class names from `EnterpriseArchitecturePrototype.tsx`.
- Produces: three visually coherent but structurally distinct layouts at 1440 × 900 and 1024 px.

- [ ] **Step 1: Define the token system**

```css
:root {
  --prototype-navy: #0b2a3b;
  --prototype-navy-2: #123e52;
  --prototype-teal: #167c74;
  --prototype-teal-soft: #e1f0ed;
  --prototype-canvas: #f3f6f8;
  --prototype-paper: #ffffff;
  --prototype-line: #d6e0e6;
  --prototype-ink: #173447;
  --prototype-muted: #657b89;
  --prototype-amber: #b88318;
  --prototype-danger: #a9433a;
}
```

- [ ] **Step 2: Build precise base typography and controls**

Set heading, body, and numeric roles from the design direction. Use 4 px, 8 px, 12 px, 16 px, 24 px, and 32 px spacing increments; border radii remain 4–10 px rather than consumer-style pills except for status tags.

- [ ] **Step 3: Style the responsibility/version rail**

Encode completed, current, warning, and unpublished states with line, label, and restrained color. The rail must remain readable without color alone.

- [ ] **Step 4: Style the three layouts independently**

Avoid a shared generic card grid. Variant A uses stable rails, Variant B uses paper/ledger divisions, and Variant C uses a wide operations board with heavier horizontal rules.

- [ ] **Step 5: Add interaction and accessibility states**

Provide hover, active, and `:focus-visible` states; add a single 160 ms content transition; disable transitions under `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 6: Add responsive rules**

At widths below 1180 px, collapse secondary exception/inspector panes beneath the main body. At widths below 860 px, switch the left navigation to a horizontal page bar and preserve table overflow.

### Task 4: Verify and present the prototype

**Files:**

- Modify only if review finds defects: `src/prototype/EnterpriseArchitecturePrototype.tsx`
- Modify only if review finds defects: `src/prototype/prototype.css`

**Interfaces:**

- Consumes: the isolated prototype URL.
- Produces: browser-reviewed prototype and screenshots for user comparison.

- [ ] **Step 1: Run static verification**

Run:

```bash
npx prettier --check package.json prototype.html vite.prototype.config.ts src/prototype
npx eslint vite.prototype.config.ts src/prototype --max-warnings 0
npx tsc -b
npm run build:prototype
```

Expected: all four commands exit 0.

- [ ] **Step 2: Start the one-command prototype server**

Run: `npm run prototype`

Expected: Vite serves `http://127.0.0.1:63182/prototype.html`.

- [ ] **Step 3: Review all twelve states**

Open every combination of:

```text
variant=A|B|C
page=work|production|market|supply
```

Confirm content is not clipped at 1440 × 900, all page and variant controls work, tables remain readable, and every screen displays the sample-data notice.

- [ ] **Step 4: Capture comparison screenshots**

Capture the recommended `A` variant on all four pages and a comparison view of variants `B` and `C`. Use the browser screenshots to remove one unnecessary decorative treatment before handoff.

- [ ] **Step 5: Present the review URLs**

Give the user the base URL and direct URLs for variants A, B, and C. State that A is recommended, ask which structure or combination should become the formal design, and do not promote prototype code directly into production.

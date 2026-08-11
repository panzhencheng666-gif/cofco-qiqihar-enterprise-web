# 齐齐哈尔粮食商情企业系统前端

企业业务平台前端，负责唯一用户入口、业务导航、填报审核、供需分析与报告工作区。
正式运行默认连接受控 API；本地验收通过同源代理接入正式 Backend 代码路径。

## Runtime

- Node.js 24.18.x
- npm 11.16.x

## Commands

```bash
npm install --ignore-scripts
npm run dev
npm run preview
npm run test
npm run test:e2e
npm run lint
npm run architecture
npm run build
npm run budget
npm run format
npm run verify
```

本地正式验收唯一入口：`http://127.0.0.1:63182/`

总揽渲染器 `63200` 和 API `8090` 仅为回环内部组件，不是用户入口。

`npm run test:e2e` first creates the production build, enforces the bundle
budget, then starts fixed-port `vite preview` for serial Chromium acceptance.
`npm run verify` uses the same production-preview path.

## Production JavaScript Budgets

`npm run budget` enforces two independent limits:

1. **Initial page:** at most 900 KiB (921,600 bytes) of total minified
   JavaScript, and no initial chunk above 900 KiB. The script reads
   `dist/index.html`, follows the Vite manifest's static `imports`, and
   deduplicates the entry script and module preloads.
2. **Every production chunk:** every JavaScript file represented by the
   production manifest, including dynamically loaded route/component chunks,
   must individually remain at or below 900 KiB.

Source maps and CSS are outside these JavaScript limits. Gzip sizes are
reported as supporting transfer evidence but are not the blocking metric.
`npm run verify` always executes both limits after a fresh production build.

The `/system/compatibility` G0 route exercises the pinned ProForm and ProTable
packages, editable and virtualized Ant Design tables, theme algorithms, and
overlay/static APIs through production-preview Chromium acceptance.

## Safety

- Do not place credentials or connection strings in browser code.
- Do not connect the browser directly to MySQL or PostgreSQL.
- Do not treat Refine access-control or audit providers as server authority.
- Do not delete the legacy Vue application before parallel acceptance and rollback rehearsal.
- Review documented dependency exceptions in
  [`docs/security/dependency-exceptions.md`](docs/security/dependency-exceptions.md)
  before changing the rendering or routing model.

# 齐齐哈尔粮食商情企业系统前端

独立 React 企业前端。当前检查点只包含技术兼容门禁、企业壳层和规范
任务—对象—业务单据纵切，使用确定性模拟数据，不连接数据库或生产 API。

## Runtime

- Node.js 24.18.x
- npm 11.16.x

## Commands

```bash
npm install --ignore-scripts
npm run dev
npm run test
npm run test:e2e
npm run lint
npm run architecture
npm run build
npm run format
npm run verify
```

Local URL: `http://127.0.0.1:63180`

## Safety

- Do not place credentials or connection strings in browser code.
- Do not connect the browser directly to MySQL or PostgreSQL.
- Do not treat Refine access-control or audit providers as server authority.
- Do not delete the legacy Vue application before parallel acceptance and rollback rehearsal.

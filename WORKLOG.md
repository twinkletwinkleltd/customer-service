# WORKLOG

Last updated: 2026-04-09

## Current status

- `customer-service` remains an independent app with its own repository and VPS deployment.
- Portal entry is available through `/apps`.
- Path handling was adjusted so the app can connect back to `portal-system` shared data instead of relying on fragile relative paths.

## 2026-04-09 — 完整重建：客户案例管理系统

### 新增页面

| 路由 | 功能 |
|------|------|
| `/` (Assistant) | 搜索栏输入客户问题，同时搜索过往案例和标准回复，分栏展示，带 Copy 按钮 |
| `/cases` | 案例列表，支持按状态 / 分类 / 关键词筛选；顶部 SKU 统计条显示各产品问题频次 |
| `/cases/new` | 四段式新建案例：客户信息 → 产品 SKU → 聊天气泡式对话录入（含自动关键词提取）→ 案例元数据 |
| `/cases/[id]` | 案例详情：完整对话记录 + 内联编辑状态/分类/解决方案 + Find Similar + Delete |

### 新增 / 重写的文件

| 文件 | 说明 |
|------|------|
| `lib/types.ts` | 所有共享类型：CustomerCase, Message, CustomerInfo, StandardReply, CasePatch, SearchResult |
| `lib/persistence.ts` | 双文件 JSON 持久化：`data/cases.json`（初始为空）+ `data/replies.json`（首次启动自动 seed） |
| `lib/keywords.ts` | 纯客户端关键词提取：去停用词、按词频取前 8 个 |
| `lib/cases.ts` | CustomerCase CRUD：getAllCases, getCaseById, createCase, patchCase, deleteCase |
| `lib/replies.ts` | StandardReply 读取 |
| `lib/search.ts` | 统一搜索：对 resolved 案例和标准回复按词频打分，返回 Top 5 |
| `app/api/cases/route.ts` | GET（支持 ?status= ?sku= ?q=）/ POST |
| `app/api/cases/[id]/route.ts` | GET / PATCH / DELETE |
| `app/api/replies/route.ts` | GET 所有标准回复 |
| `app/api/search/route.ts` | POST 统一搜索 |

### 删除的遗留文件

- `app/ssys/` — eBay CSV 导入页（不属于此模块）
- `app/pending/` — SKU 待处理页（主 portal 已有完整版）
- `app/api/cases/import/` — CSV 批量导入 API
- `app/api/inventory/` — 库存 API（整目录）
- `app/api/pending/` — Pending SKU API（整目录）
- `app/api/reply/route.ts` — 旧单一回复 API
- `lib/store.ts`, `lib/history.ts`, `lib/csv.ts` — 旧工具库

### 数据

- `data/replies.json`：从旧 seed 的 10 条 SupportCase 迁移为 StandardReply 格式，首次启动自动写入
- `data/cases.json`：真实客户案例，初始为空，案例 ID 格式为 `case-001`, `case-002` …

### 部署

- VPS `git pull` + `npm install` + `npm run build`（TypeScript 无错，9 条路由全部生成）
- `sudo systemctl restart customer-service` — 服务状态：`active (running)`，端口 3001

---

## Changes completed previously

- The app was renamed from `support-system` to `customer-service`.
- Independent GitHub repository and VPS deployment were set up.
- Shared data-path integration was repaired using explicit runtime configuration.
- `Customer Service` is live under the portal app hub.

## Next likely work

- 录入真实客户案例，积累数据后验证搜索质量
- 考虑为 Assistant 页支持 URL 参数 `?q=` 预填充（Case Detail 的 Find Similar 已使用此模式，但 Assistant 页尚未读取该参数）
- 如需多用户并发写入，可考虑加文件锁或迁移至 SQLite

## Risks / notes

- This app has its own repository and deploy lifecycle, so changes may drift if not documented here.
- The app is deployed and reachable, but future functionality work is still expected.
- Any shared data read/write logic should be validated against live VPS paths before deploy.

## Important references

- `apps/customer-service/lib/sharedPortal.ts`
- `apps/customer-service/deploy/customer-service.service`
- `PROJECT_STATUS.md`

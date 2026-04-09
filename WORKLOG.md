# WORKLOG

Last updated: 2026-04-09

## Current status

- `customer-service` 独立仓库，独立 VPS 部署，运行于端口 3001。
- 今日完成全面 UI 改版：左侧边栏导航 + 所有页面分栏布局，已构建并部署至 VPS（commit `0eefa4d`）。
- 9 条路由均正常生成，服务状态 `active (running)`。
- Portal 入口通过 `/apps` 可访问。

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

## 2026-04-09 — UI 全面优化：左侧边栏 + 分栏布局

### 改动概览

本次对所有页面进行 UI 重设计，以左侧导航栏为骨架，Assistant、Cases 列表、新建案例、案例详情均作了针对性优化。

### 新增组件

| 文件 | 说明 |
|------|------|
| `app/components/SidebarClient.tsx` | 新建客户端侧边栏组件，替代旧的顶部导航 |

**侧边栏功能：**
- 品牌标题栏（Customer Service）
- 导航项：Assistant（搜索）、Cases（列表）
- Cases 徽章：未关闭案例数，实时从 `/api/cases` 计算
- 蓝色 "+ New Case" 快捷按钮
- **本周统计迷你卡**：7 天内新案例数、已结案数、Top SKU
- "← Back to APPs" 返回链接

### 布局变更

| 文件 | 变更内容 |
|------|---------|
| `app/layout.tsx` | 移除顶部导航；`<body>` 改为 flex 横排；左侧渲染 `<SidebarClient />`，右侧 `<main>` 填充剩余空间 |
| `app/page.tsx`（Assistant）| 添加标题 + 中文副标题；使用 slate 色系；Copy 按钮改为独立行，右对齐 |
| `app/cases/page.tsx`（Cases 列表）| 状态筛选改为三段式 pill 按钮（All / Open / Resolved）；表头加 `bg-slate-50`，列宽更合理；行间距调大至 `py-3.5` |
| `app/cases/new/page.tsx`（新建案例）| **左右分栏**：左侧固定宽度 420px 含所有填写字段 + 底部粘性保存栏；右侧弹性宽对话记录区，支持实时添加气泡消息 |
| `app/cases/[id]/page.tsx`（案例详情）| **左右分栏**：左侧含客户信息网格、关键词标签、状态/分类 select、解决方案文本框、保存/删除操作栏；右侧只读对话气泡 + 底部解决方案预览区（带 Copy 按钮） |

### 交互细节

- 案例详情保存后显示 "✓ Saved" 反馈，2 秒后自动恢复按钮文字
- 案例详情右下角解决方案区随左侧输入实时更新（live preview）
- 新建案例对话框：Enter 默认添加为"客户消息"，Shift+Enter 换行；"✕ Remove last message" 悔棋按钮

### 部署

- 已推送至 `customer-service` GitHub 仓库（commit `f4b2ea9`）
- VPS 部署待手动执行：`git pull && npm run build && sudo systemctl restart customer-service`

---

## Changes completed previously

- The app was renamed from `support-system` to `customer-service`.
- Independent GitHub repository and VPS deployment were set up.
- Shared data-path integration was repaired using explicit runtime configuration.
- `Customer Service` is live under the portal app hub.

## Next likely work

- 开始录入真实客户案例，积累数据后验证 Assistant 搜索质量
- Assistant 页支持 URL 参数 `?q=` 预填充（Case Detail 的 Find Similar 已生成此链接，但 Assistant 页 `app/page.tsx` 尚未读取 `searchParams`）
- 如需多用户并发写入，可考虑加文件锁或迁移至 SQLite
- 可考虑为 Cases 列表添加排序功能（按日期 / 状态 / SKU）

## Risks / notes

- This app has its own repository and deploy lifecycle, so changes may drift if not documented here.
- The app is deployed and reachable, but future functionality work is still expected.
- Any shared data read/write logic should be validated against live VPS paths before deploy.

## Important references

- `apps/customer-service/lib/sharedPortal.ts`
- `apps/customer-service/deploy/customer-service.service`
- `PROJECT_STATUS.md`

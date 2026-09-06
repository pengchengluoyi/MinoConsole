# Mino Console

平台管理后台（纯 Web SPA）。只连接 **Mino Nexus**，没有 Electron。

## Run

```bash
npm install
npm run dev
```

开发地址：`http://localhost:5174`（`strictPort`）。不设 `VITE_NEXUS_URL` 时，Vite 把 `/auth` `/me` `/settings` `/packs` `/sys` `/runtime` `/health` `/project` 代理到 `http://mino.local:10104`。登录页不填 IP，连不上显示 **无法连接服务器**。

默认账号：`admin` / `Mino@local`（Nexus 首次启动写入）。

## 信息架构

登录后默认进入 **工作台** `/dashboard`。旧链接 `/settings/*` 会重定向。

| 分组 | 页面 | 路径 |
|---|---|---|
| 概览 | 工作台、运行状态 | `/dashboard` `/system` |
| 资产 | 项目与应用（只读） | `/catalog` |
| 人员与权限 | 成员、权限说明、操作记录 | `/members` `/access` `/audit` |
| 产品配置 | 技能、角色、编排、扩展包、发信 | `/skills` `/roles` `/stack` `/packs` `/mail` |

增删项目、用例、模型密钥、插件、Scout 安装与启动都在 **Mino Studio**。Console 的项目与应用页只读 `GET /project/list`。

See `docs/IAM.md`.

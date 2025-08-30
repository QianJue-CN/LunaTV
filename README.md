# MoonTV

<div align="center">
  <img src="public/logo.png" alt="MoonTV Logo" width="120">
</div>

> 🎬 **MoonTV** 是一个开箱即用的、跨平台的影视聚合播放器。它基于 **Next.js 14** + **Tailwind&nbsp;CSS** + **TypeScript** 构建，支持多资源搜索、在线播放、收藏同步、播放记录、云端存储，让你可以随时随地畅享海量免费影视内容。

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-14-000?logo=nextdotjs)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38bdf8?logo=tailwindcss)
![TypeScript](https://img.shields.io/badge/TypeScript-4.x-3178c6?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)
![Docker Ready](https://img.shields.io/badge/Docker-ready-blue?logo=docker)

</div>

---

## ✨ 功能特性

- 🔍 **多源聚合搜索**：一次搜索立刻返回全源结果。
- 📄 **丰富详情页**：支持剧集列表、演员、年份、简介等完整信息展示。
- ▶️ **流畅在线播放**：集成 HLS.js & ArtPlayer。
- ❤️ **收藏 + 继续观看**：支持 PostgreSQL/Redis/Upstash 混合存储，多端同步进度。
- 📱 **PWA**：离线缓存、安装到桌面/主屏，移动端原生体验。
- 🌗 **响应式布局**：桌面侧边栏 + 移动底部导航，自适应各种屏幕尺寸。
- 👿 **智能去广告**：自动跳过视频中的切片广告（实验性）。

### 注意：部署后项目为空壳项目，无内置播放源和直播源，需要自行收集

<details>
  <summary>点击查看项目截图</summary>
  <img src="public/screenshot1.png" alt="项目截图" style="max-width:600px">
  <img src="public/screenshot2.png" alt="项目截图" style="max-width:600px">
  <img src="public/screenshot3.png" alt="项目截图" style="max-width:600px">
</details>

### 请不要在 B 站、小红书、微信公众号、抖音、今日头条或其他中国大陆社交平台发布视频或文章宣传本项目，不授权任何“科技周刊/月刊”类项目或站点收录本项目。

## 🗺 目录

- [技术栈](#技术栈)
- [部署](#部署)
- [配置文件](#配置文件)
- [自动更新](#自动更新)
- [环境变量](#环境变量)
- [AndroidTV 使用](#AndroidTV-使用)
- [Roadmap](#roadmap)
- [安全与隐私提醒](#安全与隐私提醒)
- [License](#license)
- [致谢](#致谢)

## 技术栈

| 分类      | 主要依赖                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------- |
| 前端框架  | [Next.js 14](https://nextjs.org/) · App Router                                                        |
| UI & 样式 | [Tailwind&nbsp;CSS 3](https://tailwindcss.com/)                                                       |
| 语言      | TypeScript 4                                                                                          |
| 播放器    | [ArtPlayer](https://github.com/zhw2590582/ArtPlayer) · [HLS.js](https://github.com/video-dev/hls.js/) |
| 代码质量  | ESLint · Prettier · Jest                                                                              |
| 部署      | Docker                                                                                                |

## 部署

本项目**仅支持 Docker 或其他基于 Docker 的平台** 部署。

## 存储系统

LunaTV 支持多种存储方案，可根据需求选择：

- **混合存储（推荐）**：PostgreSQL + Redis，最佳性能和可靠性
- **PostgreSQL 存储**：仅使用数据库，适合简单部署
- **Upstash 存储**：云服务，免运维
- **Redis 存储**：仅缓存，有数据丢失风险

### 混合存储（推荐）

结合 PostgreSQL 和 Redis 的优势，提供最佳的性能和数据安全性：

```yml
services:
  moontv-core:
    image: ghcr.io/qianjue-cn/lunatv:latest
    container_name: moontv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - LUNATV_USERNAME=admin  # 推荐使用，避免环境变量冲突
      - PASSWORD=admin_password
      - STORAGE_TYPE=hybrid
      - DATABASE_URL=postgresql://moontv:password@moontv-postgres:5432/moontv
      - REDIS_URL=redis://:redis_password@moontv-redis:6379
    networks:
      - moontv-network
    depends_on:
      - moontv-postgres
      - moontv-redis

  moontv-postgres:
    image: postgres:15-alpine
    container_name: moontv-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=moontv
      - POSTGRES_USER=moontv
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - moontv-network

  moontv-redis:
    image: redis:alpine
    container_name: moontv-redis
    restart: unless-stopped
    command: redis-server --requirepass redis_password
    volumes:
      - redis-data:/data
    networks:
      - moontv-network

networks:
  moontv-network:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
```

### PostgreSQL 存储

仅使用 PostgreSQL 数据库，适合简单部署：

```yml
services:
  moontv-core:
    image: ghcr.io/qianjue-cn/lunatv:latest
    container_name: moontv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - LUNATV_USERNAME=admin  # 推荐使用，避免环境变量冲突
      - PASSWORD=admin_password
      - STORAGE_TYPE=postgres
      - DATABASE_URL=postgresql://moontv:password@moontv-postgres:5432/moontv
    networks:
      - moontv-network
    depends_on:
      - moontv-postgres

  moontv-postgres:
    image: postgres:15-alpine
    container_name: moontv-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=moontv
      - POSTGRES_USER=moontv
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - moontv-network

networks:
  moontv-network:
    driver: bridge

volumes:
  postgres-data:
```

### Kvrocks 存储（兼容性保持）

```yml
services:
  moontv-core:
    image: ghcr.io/qianjue-cn/lunatv:latest
    container_name: moontv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - LUNATV_USERNAME=admin  # 推荐使用，避免环境变量冲突
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=kvrocks
      - KVROCKS_URL=redis://moontv-kvrocks:6666
    networks:
      - moontv-network
    depends_on:
      - moontv-kvrocks
  moontv-kvrocks:
    image: apache/kvrocks
    container_name: moontv-kvrocks
    restart: unless-stopped
    volumes:
      - kvrocks-data:/var/lib/kvrocks
    networks:
      - moontv-network
networks:
  moontv-network:
    driver: bridge
volumes:
  kvrocks-data:
```

### Redis 存储（有一定的丢数据风险）

```yml
services:
  moontv-core:
    image: ghcr.io/qianjue-cn/lunatv:latest
    container_name: moontv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - LUNATV_USERNAME=admin  # 推荐使用，避免环境变量冲突
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=redis
      - REDIS_URL=redis://moontv-redis:6379
    networks:
      - moontv-network
    depends_on:
      - moontv-redis
  moontv-redis:
    image: redis:alpine
    container_name: moontv-redis
    restart: unless-stopped
    networks:
      - moontv-network
    # 请开启持久化，否则升级/重启后数据丢失
    volumes:
      - ./data:/data
networks:
  moontv-network:
    driver: bridge
```

### Upstash 存储

1. 在 [upstash](https://upstash.com/) 注册账号并新建一个 Redis 实例，名称任意。
2. 复制新数据库的 **HTTPS ENDPOINT 和 TOKEN**
3. 使用如下 docker compose

```yml
services:
  moontv-core:
    image: ghcr.io/qianjue-cn/lunatv:latest
    container_name: moontv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - LUNATV_USERNAME=admin  # 推荐使用，避免环境变量冲突
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=upstash
      - UPSTASH_URL=上面 https 开头的 HTTPS ENDPOINT
      - UPSTASH_TOKEN=上面的 TOKEN
```

## 配置文件

完成部署后为空壳应用，无播放源，需要站长在管理后台的配置文件设置中填写配置文件（后续会支持订阅）

配置文件示例如下：

```json
{
  "cache_time": 7200,
  "api_site": {
    "dyttzy": {
      "api": "http://xxx.com/api.php/provide/vod",
      "name": "示例资源",
      "detail": "http://xxx.com"
    }
    // ...更多站点
  },
  "custom_category": [
    {
      "name": "华语",
      "type": "movie",
      "query": "华语"
    }
  ]
}
```

- `cache_time`：接口缓存时间（秒）。
- `api_site`：你可以增删或替换任何资源站，字段说明：
  - `key`：唯一标识，保持小写字母/数字。
  - `api`：资源站提供的 `vod` JSON API 根地址。
  - `name`：在人机界面中展示的名称。
  - `detail`：（可选）部分无法通过 API 获取剧集详情的站点，需要提供网页详情根 URL，用于爬取。
- `custom_category`：自定义分类配置，用于在导航中添加个性化的影视分类。以 type + query 作为唯一标识。支持以下字段：
  - `name`：分类显示名称（可选，如不提供则使用 query 作为显示名）
  - `type`：分类类型，支持 `movie`（电影）或 `tv`（电视剧）
  - `query`：搜索关键词，用于在豆瓣 API 中搜索相关内容

custom_category 支持的自定义分类已知如下：

- movie：热门、最新、经典、豆瓣高分、冷门佳片、华语、欧美、韩国、日本、动作、喜剧、爱情、科幻、悬疑、恐怖、治愈
- tv：热门、美剧、英剧、韩剧、日剧、国产剧、港剧、日本动画、综艺、纪录片

也可输入如 "哈利波特" 效果等同于豆瓣搜索

MoonTV 支持标准的苹果 CMS V10 API 格式。

## 自动更新

可借助 [watchtower](https://github.com/containrrr/watchtower) 自动更新镜像容器

dockge/komodo 等 docker compose UI 也有自动更新功能

## 环境变量

### 重要说明

#### 用户注册密码要求
- **密码长度**：最少6个字符（已降低要求）
- **密码组成**：必须包含字母和数字
- **限制条件**：不能与用户名或邮箱完全相同，不能是常见的简单密码（如"123456"、"password"等）

#### 环境变量冲突解决
在Windows系统或某些Docker环境中，`USERNAME` 环境变量可能与系统变量冲突。如果遇到站长登录问题，请使用 `LUNATV_USERNAME` 替代：

```yml
environment:
  - LUNATV_USERNAME=admin  # 推荐在Docker中使用
  - PASSWORD=your_password
```

系统会优先使用 `LUNATV_USERNAME`，如果未设置则回退到 `USERNAME`。

| 变量                                | 说明                     | 可选值                                    | 默认值                                                                                                                     |
| ----------------------------------- | ------------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| USERNAME                            | 站长账号                 | 任意字符串                                | 无默认，必填字段                                                                                                           |
| LUNATV_USERNAME                     | 站长账号（Docker推荐）   | 任意字符串                                | 无默认，可选（避免Windows系统USERNAME环境变量冲突）                                                                        |
| PASSWORD                            | 站长密码                 | 任意字符串                                | 无默认，必填字段                                                                                                           |
| SITE_BASE                           | 站点 url                 | 形如 https://example.com                  | 空                                                                                                                         |
| NEXT_PUBLIC_SITE_NAME               | 站点名称                 | 任意字符串                                | MoonTV                                                                                                                     |
| ANNOUNCEMENT                        | 站点公告                 | 任意字符串                                | 本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。 |
| **存储系统配置**                    |                          |                                           |                                                                                                                            |
| STORAGE_TYPE                        | 存储类型                 | hybrid、postgres、redis、upstash、kvrocks | 无默认，必填字段                                                                                                           |
| DATABASE_URL                        | PostgreSQL 数据库连接    | postgresql://user:pass@host:port/db       | 空（hybrid/postgres 模式必填）                                                                                             |
| REDIS_URL                           | Redis 连接 url           | redis://[user:pass@]host:port[/db]        | 空（hybrid/redis 模式必填）                                                                                                |
| UPSTASH_URL                         | Upstash Redis 连接 url   | https://...                               | 空（upstash 模式必填）                                                                                                     |
| UPSTASH_TOKEN                       | Upstash Redis token      | 连接 token                                | 空（upstash 模式必填）                                                                                                     |
| KVROCKS_URL                         | Kvrocks 连接 url         | redis://host:port                         | 空（kvrocks 模式必填）                                                                                                     |
| NEXT_PUBLIC_SEARCH_MAX_PAGE         | 搜索接口可拉取的最大页数 | 1-50                     | 5                                                                                                                          |
| NEXT_PUBLIC_DOUBAN_PROXY_TYPE       | 豆瓣数据源请求方式       | 见下方                   | direct                                                                                                                     |
| NEXT_PUBLIC_DOUBAN_PROXY            | 自定义豆瓣数据代理 URL   | url prefix               | (空)                                                                                                                       |
| NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE | 豆瓣图片代理类型         | 见下方                   | direct                                                                                                                     |
| NEXT_PUBLIC_DOUBAN_IMAGE_PROXY      | 自定义豆瓣图片代理 URL   | url prefix               | (空)                                                                                                                       |
| NEXT_PUBLIC_DISABLE_YELLOW_FILTER   | 关闭色情内容过滤         | true/false               | false                                                                                                                      |
| NEXT_PUBLIC_FLUID_SEARCH            | 是否开启搜索接口流式输出 | true/ false                           | true                                                                                                                       |

### 存储类型说明

**STORAGE_TYPE** 选项解释：

- **hybrid**（推荐）：PostgreSQL + Redis 混合存储
  - PostgreSQL：持久化数据（用户信息、配置、收藏夹等）
  - Redis：缓存层 + 高频数据（播放记录、搜索历史等）
  - 优势：最佳性能、数据安全、支持缓存
  - 需要：`DATABASE_URL` + `REDIS_URL`

- **postgres**：仅使用 PostgreSQL 数据库
  - 适合：简单部署、数据安全要求高
  - 优势：数据持久化、事务支持
  - 需要：`DATABASE_URL`

- **redis**：仅使用 Redis 缓存
  - 适合：高性能要求、临时数据
  - 风险：重启后数据可能丢失
  - 需要：`REDIS_URL`

- **upstash**：使用 Upstash 云服务
  - 适合：免运维、云端部署
  - 优势：托管服务、自动备份
  - 需要：`UPSTASH_URL` + `UPSTASH_TOKEN`

- **kvrocks**：兼容性保持
  - 与 Redis 协议兼容
  - 需要：`KVROCKS_URL`

### 豆瓣代理配置

NEXT_PUBLIC_DOUBAN_PROXY_TYPE 选项解释：

- direct: 由服务器直接请求豆瓣源站
- cors-proxy-zwei: 浏览器向 cors proxy 请求豆瓣数据，该 cors proxy 由 [Zwei](https://github.com/bestzwei) 搭建
- cmliussss-cdn-tencent: 浏览器向豆瓣 CDN 请求数据，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由腾讯云 cdn 提供加速
- cmliussss-cdn-ali: 浏览器向豆瓣 CDN 请求数据，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由阿里云 cdn 提供加速
- custom: 用户自定义 proxy，由 NEXT_PUBLIC_DOUBAN_PROXY 定义

NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE 选项解释：

- direct：由浏览器直接请求豆瓣分配的默认图片域名
- server：由服务器代理请求豆瓣分配的默认图片域名
- img3：由浏览器请求豆瓣官方的精品 cdn（阿里云）
- cmliussss-cdn-tencent：由浏览器请求豆瓣 CDN，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由腾讯云 cdn 提供加速
- cmliussss-cdn-ali：由浏览器请求豆瓣 CDN，该 CDN 由 [CMLiussss](https://github.com/cmliu) 搭建，并由阿里云 cdn 提供加速
- custom: 用户自定义 proxy，由 NEXT_PUBLIC_DOUBAN_IMAGE_PROXY 定义

## AndroidTV 使用

目前该项目可以配合 [OrionTV](https://github.com/zimplexing/OrionTV) 在 Android TV 上使用，可以直接作为 OrionTV 后端

已实现播放记录和网页端同步

## 常见问题

### 站长无法登录管理面板

**问题描述**：在混合模式下，站长登录后无法访问管理面板，被重定向到登录页面。

**解决方案**：这通常是由于环境变量冲突导致的，特别是在Windows系统或某些Docker环境中。

1. **使用 LUNATV_USERNAME 环境变量**（推荐）：
   ```yml
   environment:
     - LUNATV_USERNAME=admin  # 替代 USERNAME
     - PASSWORD=your_password
   ```

2. **或者在Docker中明确设置**：
   ```yml
   environment:
     - USERNAME=admin
     - PASSWORD=your_password
   ```

### 用户注册密码要求过严

**问题描述**：用户注册时提示"密码不应包含个人信息"或密码强度不足。

**解决方案**：系统已降低密码要求，现在只需要：
- 至少6个字符
- 包含字母和数字
- 不与用户名或邮箱完全相同
- 不是极其简单的密码（如"123456"、"password"等）

### Docker部署登录页面只显示密码输入框

**问题描述**：在Docker部署的混合模式下，登录页面只显示访问密码输入框，没有用户名输入框。

**解决方案**：确保正确设置存储类型环境变量：
```yml
environment:
  - STORAGE_TYPE=hybrid  # 使用新的环境变量名
  - LUNATV_USERNAME=admin
  - PASSWORD=your_password
```

## 安全与隐私提醒

### 请设置密码保护并关闭公网注册

为了您的安全和避免潜在的法律风险，我们要求在部署时**强烈建议关闭公网注册**：

### 部署要求

1. **设置环境变量 `PASSWORD`**：为您的实例设置一个强密码
2. **仅供个人使用**：请勿将您的实例链接公开分享或传播
3. **遵守当地法律**：请确保您的使用行为符合当地法律法规

### 重要声明

- 本项目仅供学习和个人使用
- 请勿将部署的实例用于商业用途或公开服务
- 如因公开分享导致的任何法律问题，用户需自行承担责任
- 项目开发者不对用户的使用行为承担任何法律责任
- 本项目不在中国大陆地区提供服务。如有该项目在向中国大陆地区提供服务，属个人行为。在该地区使用所产生的法律风险及责任，属于用户个人行为，与本项目无关，须自行承担全部责任。特此声明

## License

[MIT](LICENSE) © 2025 MoonTV & Contributors

## 致谢

- [ts-nextjs-tailwind-starter](https://github.com/theodorusclarence/ts-nextjs-tailwind-starter) — 项目最初基于该脚手架。
- [LibreTV](https://github.com/LibreSpark/LibreTV) — 由此启发，站在巨人的肩膀上。
- [ArtPlayer](https://github.com/zhw2590582/ArtPlayer) — 提供强大的网页视频播放器。
- [HLS.js](https://github.com/video-dev/hls.js) — 实现 HLS 流媒体在浏览器中的播放支持。
- [Zwei](https://github.com/bestzwei) — 提供获取豆瓣数据的 cors proxy
- [CMLiussss](https://github.com/cmliu) — 提供豆瓣 CDN 服务
- 感谢所有提供免费影视接口的站点。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=MoonTechLab/LunaTV&type=Date)](https://www.star-history.com/#MoonTechLab/LunaTV&Date)

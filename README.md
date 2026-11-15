# AI 团队办公室（3D · 现代简约风）

Three.js 制作的 3D 办公室（40×25 紧凑楼层）：沿墙为老板办公室（Eldon 老板，转角双窗）、总监室（Grok Bot 调度看板）、会议室（BTC 实时行情大屏）、茶水间、休息区；右前方为前台接待与 AI TEAM 品牌墙，左侧为讨论区/白板/书架，右侧为打印复印区与文件柜；中间是 6 个 6 人工位岛（共 36 个座位），Bot 按名单顺序从第一个工位岛坐起，空位保留为备用工位。角色沿走廊和门口行走。
各 Bot 的状态（工作中 / 思考中 / 浏览网页 / 需要帮助 / 空闲 / 已完成）实时显示；空闲时Q版小人走去休息区沙发坐下，完成任务时撒彩带。点击角色可拉近查看。
支持昼夜切换（自动 / 白天 / 夜晚）、演示模式（仅本地模拟，不写服务器；也可用 `?demo` 打开）、手机访问（单指旋转、双指缩放/平移，双击复位视角）。

## 目录
```
server.js              后端（纯 Node.js，无第三方依赖）
public/                前端静态文件（three.js 已本地化在 public/vendor）
data/bots.json         Bot 名单（可编辑，保存后约 2 秒自动生效）
data/office.json       办公室标题、老板信息（展示用，无需 Token）
data/state.json        各 Bot 当前状态（服务器写入，原子写）
data/tokens.json       Token 的 SHA-256 哈希（权限 600，绝不对外提供）
.env                   端口、限流等配置（权限 600）
bin/office-admin.js    管理命令（已链接为 office-admin）
bin/office-report      上报命令（已链接为 office-report）
start.sh               守护启动（崩溃自动重启；TUNNEL=1 时同时启动 Cloudflare 隧道）
SECRETS-initial-tokens.txt  初始 Token 明文（权限 600，请转存到安全处后删除）
```

## 编辑名单 / 增加岗位
`data/bots.json` 示例：
```json
{ "bots": [
  { "id": "grok", "name": "Grok Bot", "role": "总监/调度", "color": "#f5a623", "zone": "director", "room": "director" },
  { "id": "secretary", "name": "秘书", "role": "秘书", "color": "#e94e77", "zone": "desk", "room": "secretary" }
] }
```
- `id`：小写字母/数字/`-`/`_`，上报时使用，改了 id 需重新发 Token。
- `name`、`role`：直接改名即可，页面自动更新。
- `color`：`#RRGGBB`。`zone`：`director`（总监室）或 `desk`。
- `room`：机器人所在房间 id（不填则按角色自动判断，满员或未知房间自动进备用房）：

| room id | 默认名称 | 工位 |
|---|---|---|
| `director` | 总监室 | 1 |
| `secretary` | 秘书室 | 2 |
| `design` | 设计部 | 2 |
| `admin` | 行政部 | 2 |
| `purchasing` | 采购部 | 2 |
| `spare1` / `spare2` | 备用房 1 / 2 | 各 3 |
| `print` / `craft` / `store` | 印刷房 / 手工房 / 储物间 | NPC 未占用的空位 |

  另有不可分配的 `boss`（老板办公室）、`meeting`（会议室）、`tea`（茶水间）、`lounge`（休息区，空闲时去这两处）。
- 新增岗位推荐用命令（会同时生成 Token，只显示一次）：
```bash
office-admin add marketing 市场 市场专员 '#00d2ff'
office-admin list
office-admin rotate secretary   # 重置 Token，旧 Token 立即失效
office-admin remove marketing
```
手动在 bots.json 里加条目也能出现工位，但需要再执行 `office-admin rotate <id>` 才能上报。
老板名字/头衔在 `data/office.json` 修改。

### data/office.json
```json
{ "title": "AI 团队办公室",
  "boss": { "name": "Eldon", "title": "老板", "color": "#c0392b" },
  "rooms": { "spare1": "市场部", "print": "印刷房" },
  "npcs": { "print": 3, "craft": 6, "store": 2 } }
```
- `rooms`：改门牌名称（只填要改的即可），页面几秒内自动更新。
- `npcs`：印刷房 / 手工房 / 储物间的展示用员工人数（上限分别 4 / 8 / 3）。他们只是装饰：没有 Token、不能上报、不在团队面板里。

## 上报状态：office-report
```bash
office-report grok working "生成日报"
office-report secretary 思考中 "整理老板行程"
office-report designer browsing "搜索设计灵感"
office-report admin 需要帮助 "打印机卡纸"
office-report purchasing done "订单已下单"
office-report purchasing idle
```
状态（中英文都可）：`working/工作中`、`thinking/思考中`、`browsing/浏览网页`、`help/需要帮助`、`idle/空闲`、`done/已完成`。

配置写在 `~/.office-report`（建议 `chmod 600`），或用环境变量：
```
OFFICE_URL=https://ai-office-vk1v.onrender.com
OFFICE_TOKEN_GROK=ofc_xxx
OFFICE_TOKEN_SECRETARY=ofc_xxx
# 或者单个 Bot 机器上只设 OFFICE_TOKEN=ofc_xxx
```
其他机器没有脚本时，等价 curl：
```bash
curl -X POST "$OFFICE_URL/api/report" \
  -H "Authorization: Bearer $OFFICE_TOKEN" -H "Content-Type: application/json" \
  -d '{"bot":"secretary","status":"working","task":"整理会议纪要"}'
```

## API
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/state` | 公开只读：`office`（标题/老板）+ `bots[]`：id、name、role、color、zone、status、task、updatedAt。不含任何 Token |
| GET | `/api/btc` | BTC/USD 行情代理（CoinGecko，失败回退 Coinbase），服务器缓存 30 秒 |
| POST | `/api/report` | `Authorization: Bearer <token>`，JSON `{bot, status, task}`；Token 必须属于该 bot |
| GET | `/healthz` | 健康检查 |

返回码：200 成功 · 400 状态无效/JSON 错误 · 401 鉴权失败 · 404 名单无此 Bot · 413 请求体过大 · 415 非 JSON · 429 限流。

## 安全
- 每个 Bot 独立 Token，服务器只存 SHA-256 哈希，常量时间比较；Token 不进前端、不进日志、不出现在 API。
- 限流（`.env` 可调）：上报每 IP、每 Token 各 30 次/分；读取 120 次/分/IP；鉴权失败 10 次/分后该 IP 暂时封禁；请求体上限 2KB。
- 任务文字最长 120 字，去除控制字符；前端只用 textContent / Canvas 绘制，无 innerHTML，防 XSS。
- 安全响应头：CSP（仅允许本站脚本）、nosniff、X-Frame-Options、Referrer-Policy 等；CORS 默认关闭（同源），需要跨域时在 `.env` 的 `ALLOWED_ORIGINS` 填写。
- 位于隧道/反代之后时，仅信任来自本机的 `CF-Connecting-IP` / `X-Forwarded-For`。
- data/ 不在静态目录内，静态服务拒绝路径穿越与隐藏文件。

## 在线地址（Render）
- 公网地址：**https://ai-office-vk1v.onrender.com**
- 代码仓库：https://github.com/eldonlooi88-sketch/ai-office （推送到 `main` 会自动重新部署）
- Render 服务：ai-office（Free 套餐，新加坡区），构建 `npm ci --omit=dev`，启动 `node server.js`，健康检查 `/healthz`
- 环境变量：
  - `OFFICE_TOKEN_HASHES`：各 Bot Token 的 SHA-256 哈希 JSON（不是明文 Token）。在本机执行 `node bin/office-admin.js env-hashes` 生成，粘贴到 Render → Environment。
  - `NODE_ENV=production`、`PROXY_MODE=render`、`TRUST_PROXY=1`、`HOST=0.0.0.0`（`PORT` 由 Render 自动提供）
- 新增岗位 / 轮换 Token：本机 `office-admin add/rotate` 后，把 `bots.json` 提交推送，并用 `env-hashes` 的新输出更新 Render 的 `OFFICE_TOKEN_HASHES`（保存后服务会重启）。
- Free 套餐注意：
  - 15 分钟无访问会休眠，下次打开需等约 30–60 秒唤醒（office-report 第一次上报可能较慢）。
  - 文件系统是临时的：重启 / 重新部署 / 休眠唤醒后，`state.json` 里的状态会清空（所有 Bot 显示空闲，直到下次上报）。名单与房间配置在仓库里，不受影响。
  - 需要持久保存状态请升级付费套餐并挂载 Persistent Disk（设置 `DATA_DIR` 指向磁盘并放入 bots.json / office.json）。
- `data/tokens.json`、`.env`、`SECRETS-*` 均在 .gitignore 中，不会进入仓库；云端只使用哈希。

## 本机运行
```bash
./start.sh                 # 只启动服务（127.0.0.1:8787）
TUNNEL=1 ./start.sh        # 同时启动 Cloudflare 快速隧道，网址见 logs/tunnel.log
```
- 快速隧道（trycloudflare.com）网址在机器或隧道重启后会变化；要固定域名，需要你自己的 Cloudflare 账号和域名（命名隧道）。
- 也可以部署到任意 VPS / 云主机（只需 Node 18+）：复制整个目录，执行 `./start.sh`，前面放 Nginx/Caddy 提供 HTTPS 即可；或使用附带的 Dockerfile。

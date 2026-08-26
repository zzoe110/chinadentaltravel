# China Dental Travel — 网站源码

中国口腔医疗旅游平台官网。**前台全英文 + 后台全中文**，面向海外患者，托管于 CloudFlare Pages（免费）。

## 技术栈
- 纯静态站点，由 `build.mjs`（零依赖 Node 脚本）从 `content/*.json` 生成 `dist/`
- 后台：**Decap CMS**（`admin/`，全中文界面），内容即 JSON 文件
- 字体：Inter + Noto Sans SC（SIL Open Font License，免费可商用）
- 水印：CSS 平铺水印 + 前端上传烘焙（`bakeWatermark`）+ 可选 Cloudflare Worker（`workers/watermark.js`）
- SEO/GEO：每页独立 Meta/OG/Twitter + JSON-LD 结构化数据 + sitemap.xml + robots.txt

## 目录结构
```
web/
├── content/            # 所有可编辑内容（JSON）← 后台就改这里
│   ├── site.json       # 全局设置：联系方式 / 统计代码 / SEO / 免责声明
│   ├── services/*.json # 治疗项目（可增删）
│   ├── cities/*.json   # 目的地城市（可增删，含旅游+医疗两大板块）
│   └── faq.json        # 常见问题
├── src/                # 样式与脚本（会被复制到 dist/assets）
│   ├── css/style.css
│   └── js/main.js      # 翻译/菜单/水印/防右键
├── admin/              # Decap CMS 后台（中文）
├── workers/            # 可选：Cloudflare 水印 Worker
├── build.mjs           # 构建脚本（生成 dist/）
└── dist/               # 构建产物（部署目录）
```

## 本地预览
```bash
cd web
node build.mjs
# 用任意静态服务器打开 dist/，例如：
python3 -m http.server 8080 --directory dist
# 浏览器访问 http://localhost:8080
```

## 部署到 CloudFlare Pages（免费）
1. 把 `web/` 推到 GitHub 仓库。
2. CloudFlare Pages → 连接仓库 → 构建设置：
   - **Build command**: `node build.mjs`
   - **Build output directory**: `dist`
   - （在仓库根目录放一个指向 web 的注意：若整个仓库即为 web，则命令改为 `node build.mjs`、输出 `dist`）
3. 自定义域：`chinadentaltravel.com`（在 DNS 指向 CloudFlare）。
4. **开启后台**：Pages → 设置 → Git Gateway（开启），用于 Decap CMS 提交内容。
5. 访问 `https://你的域名/admin/` 用 GitHub 登录即可管理（全中文）。

> 本地想免 GitHub 预览后台：把 `admin/config.yml` 的 `backend` 临时改成 `local`。

## 后台管理（全中文）
登录 `/admin/` 后可编辑：
- **全局设置**：WhatsApp/邮箱/电话、统计代码（直接粘贴 GA/GTM）、SEO 关键词、免责声明
- **治疗项目**：增删项目、价格区间、包含项、FAQ
- **目的地城市**：增删城市；每个城市含「旅游目的地」与「医疗资源」两大板块、机构、医生、按项目价格
- **常见问题**

新增一个城市 = 在「目的地城市」点「新建」，填完保存即上线（重新构建部署后生效）。

## 合规提醒
- 宣传避免「保证治愈」等承诺用语（已在免责声明中标注）。
- 价格为区间，标注「以医生评估为准」。
- 部署后建议开启 CloudFlare Hotlink Protection 防盗链。

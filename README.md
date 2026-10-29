# 余亚雄的笔记

中文个人博客，发布原创商业案例分析与经营思考。

站点：https://yuyaxiong.github.io/

## 结构

- `content/posts/`：原创 Markdown 文章与 JSON 元数据。
- `scripts/`：内容校验、页面组件、模板与构建程序。
- `static/`：样式、浏览器交互与图标。
- `vendor/`：Marked 17.0.5 与其 MIT 许可；无需安装依赖。
- `docs/`：本地构建预览目录，不提交；生成文件同时同步到仓库根目录。
- `.pages-files.json`：根目录生成文件清单。清单内文件不要手动编辑。

## 新增文章

1. 在 `content/posts/` 新建 `YYYY-MM-DD-short-name.md`。
2. 使用现有文章的 JSON front matter，修改 title、slug、date、updated、author、category、tags、description。slug 使用小写英文和连字符且不可重复。`status` 为 `draft` 时不输出公开网页，但仓库本身是公开的，所以敏感草稿不要放进仓库。
   - 内容形式标签：`外文精读` 适用于基于外文资料的解读与分析；`翻译` 仅用于具有许可或授权的实际译文，不要混用。
3. 在第二个 `---` 后写 Markdown。文章中的二级标题会生成目录，分类、标签、RSS、站点地图自动更新。
4. 安装 Node.js 20 或更新版本，在仓库根目录运行 `node scripts/build.mjs` 与 `node scripts/check.mjs`。无需 npm install。
5. 预览：`python3 -m http.server 4173 --directory docs`，浏览器打开 http://localhost:4173/。
6. 把文章、修改的站点源文件、根目录生成页面及 `.pages-files.json` 一起提交并推送 main。GitHub Pages 从 `main /(root)` 自动部署。可在仓库 Actions 查看进度；Settings → Pages 查看线上地址。

也可运行 `npm run build`、`npm run check`、`npm run preview`，它们只是上述命令的快捷方式。

### 技术文章的数学公式

文章元数据设置 `"math": true` 后，支持 `$...$` 行内公式和独占行的 `$$` 块级公式。构建时使用 vendored KaTeX 0.16.22 输出原生 MathML，浏览器无需加载公式脚本或外部字体；无效公式会阻止构建。阅读需使用支持 MathML 的现代浏览器。可用 `styles` 数组声明 `/assets/` 下的本地 CSS；已有文章默认不启用数学解析。KaTeX 的 MIT 许可见 `vendor/LICENSE-katex.txt`，固定上游包为 `https://registry.npmjs.org/katex/-/katex-0.16.22.tgz`。数学排版与文章资源隔离测试包含在 `npm run check` 中。

### 营销方法论的图示与测算

营销转化文章保留完整 Markdown 正文，使用 `<!-- marketing-visual:fcb -->` 等七个具名标记插入图示。图示在 `scripts/marketing-visuals.mjs` 中生成，仅对该文章启用；不在 Markdown 中嵌入可执行脚本。样式为 `static/assets/marketing-visuals.css`，计算逻辑为 `marketing-economics.mjs`，浏览器交互为 `marketing-calculator.mjs`。模板只加载该文章声明的本地资源。

修改图示时保留同段的正文与完整表格。测算输入仅在浏览器内存中使用，不保存、不发送，也不加入统计事件；关闭 JavaScript 后仍保留默认图示和原有静态算例。检查覆盖原始算例、亏损、零成交、零线索、非法参数及文章资源隔离。

## 发布与回滚

Pages 配置：Deploy from a branch → main → /(root)。根目录 `.nojekyll` 避免二次处理。修正旧文章后更新 `updated`，重新构建、校验、提交。需要回滚时对有问题的提交执行 Git revert，再推送；保留历史，不强制覆盖分支。站点是用户主页，URL 根路径固定；迁移域名时需修改 `site.json` 与构建中的 URL 校验。

发布流程：本地编辑 → 内容校验与构建 → 检查生成目录 → 提交 → GitHub Pages 构建 → 线上核验。构建失败不会更新已部署的版本；修复原因后重新构建并提交。只在文章确认可公开后放入本仓库。

## 隐私与版权

本仓库只保存原创文章与博客源代码、生成页面及 Marked 第三方许可。不要加入原案例 PDF、完整译本、个人文件或凭据。发布目录从明确的公开输入生成。`check` 提供常见泄漏检测，但不能替代提交前阅读文件清单。

博客没有用户账户、评论或表单服务。搜索在本地完成，RSS 阅读器会直接请求静态订阅文件。访问统计由 `site.json` 控制，默认关闭；启用后《关于本站》的隐私说明会同时更新。

原创文章保留权利，转载请联系作者并注明来源。站点第三方解析器许可见 `vendor/LICENSE-marked.md`。引用资料的权利归原权利人所有。

## GoatCounter 访问统计

当前已绑定 GoatCounter 账号 `yuyaxiong`，`analytics.enabled` 为 `true`，统计后台：https://yuyaxiong.goatcounter.com/ 。只有 HTTPS 正式站点会加载统计服务。统计从接入上线后开始积累，不包含此前的历史访问。

1. 由博客所有者在 https://www.goatcounter.com/signup 注册账号并设置密码。Site domain 填 `yuyaxiong.github.io`，可用的 Account name 建议选 `yuyaxiong-blog`。注册后确认后台地址和邮箱归属，不要把密码、登录 Cookie 或 API token 写入仓库。
2. 在 GoatCounter 设置中保持统计后台非公开（Public dashboard 关闭），时区设为 Asia/Shanghai；保持逐次访问明细采集关闭。统计账号名是公开配置，不是密钥。
3. 将 `site.json` 中的 `analytics.code` 改为实际账号名（只填 `.goatcounter.com` 前面的部分），再将 `analytics.enabled` 改为 `true`。不要使用尚未注册或不属于自己的站点名。
4. 运行 `npm run build` 和 `npm run check`。统一模板会把统计加载入口加入全站 HTML，并同步生成隐私说明。发布时提交源文件和根目录生成文件。
5. 部署完成后访问正式文章，在浏览器网络面板确认 `/assets/goatcounter-count.js` 和对应 `/count` 请求，再在自己的 GoatCounter 后台确认页面记录。后台可按页面、日期查看浏览次数、估算访客数和来源网站。只有完成请求与后台记录核验后，才能确认接入成功。

统计仅在 HTTPS 正式域名加载，本地和其他预览域名不计数；发送页面路径时去除查询参数与锚点，来源仅保留 origin。不会采集站内搜索词或绑定点击事件。拦截器、网络限制可能导致少计，浏览量不等于读完人数；上线前的历史访问无法补回。

关闭统计：将 `analytics.enabled` 改为 `false`，重新构建、校验并发布。之后的页面不再加载统计入口，阅读、搜索、打印仍可使用；这不会删除 GoatCounter 已有数据。可在登录后的 GoatCounter 设置中排除自己的浏览，参考 https://www.goatcounter.com/help/skip-dev 。测试用例使用隔离环境，不向统计后台制造测试流量。

### 统计脚本版本

统计客户端按官方支持的同域托管方式随博客发布，避免单独依赖 `gc.zgo.at` 的脚本下载连接。统计请求仍发送到配置的 GoatCounter 账号。

- 上游：https://github.com/arp242/goatcounter
- 源文件：`public/count.js`
- 固定来源版本：478f026eb9deacb9378a46b96db72e11e9f20557
- 原始 Git blob SHA：3b5f6bc87a35c67875fd3efe52e75f8317949d85
- SHA-256：792b7abd26c1fb6ae62906833e09a301251e2641816e69e4f95aba518f3fe3f0
- 发布文件：`static/assets/goatcounter-count.js`；源文件未修改，保留原 ISC 许可声明。
- 本站加载器在客户端初次计数之前清除额外的 `q` 参数，防止发送站内搜索词。更新客户端时需要重新运行包含上游客户端的请求载荷测试。
- 官方说明：https://www.goatcounter.com/help/countjs-host


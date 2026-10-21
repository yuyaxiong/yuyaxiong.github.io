# 余亚雄的笔记

中文个人博客，发布原创商业案例分析与经营思考。

站点：https://yuyaxiong.github.io/

## 结构

- `content/posts/`：原创 Markdown 文章与 JSON 元数据。
- `scripts/`：内容校验、页面组件、模板与构建程序。
- `static/`：样式、浏览器交互与图标。
- `vendor/`：Marked 17.0.5 与其 MIT 许可；无需安装依赖。
- `docs/`：GitHub Pages 实际发布目录；由构建生成，不直接编辑。

## 新增文章

1. 在 `content/posts/` 新建 `YYYY-MM-DD-short-name.md`。
2. 使用现有文章的 JSON front matter，修改 title、slug、date、updated、author、category、tags、description。slug 使用小写英文和连字符且不可重复。`status` 为 `draft` 时不输出公开网页，但仓库本身是公开的，所以敏感草稿不要放进仓库。
3. 在第二个 `---` 后写 Markdown。文章中的二级标题会生成目录，分类、标签、RSS、站点地图自动更新。
4. 安装 Node.js 20 或更新版本，在仓库根目录运行 `node scripts/build.mjs` 与 `node scripts/check.mjs`。无需 npm install。
5. 预览：`python3 -m http.server 4173 --directory docs`，浏览器打开 http://localhost:4173/。
6. 把文章、修改的站点源文件与重新生成的 `docs/` 一起提交并推送 main。GitHub Pages 从 `main /docs` 自动部署。可在仓库 Actions 查看进度；Settings → Pages 查看线上地址。

也可运行 `npm run build`、`npm run check`、`npm run preview`，它们只是上述命令的快捷方式。

## 发布与回滚

Pages 配置：Deploy from a branch → main → /docs。`docs/.nojekyll` 避免二次处理。修正旧文章后更新 `updated`，重新构建、校验、提交。需要回滚时对有问题的提交执行 Git revert，再推送；保留历史，不强制覆盖分支。站点是用户主页，URL 根路径固定；迁移域名时需修改 `site.json` 与构建中的 URL 校验。

发布流程：本地编辑 → 内容校验与构建 → 检查生成目录 → 提交 → GitHub Pages 构建 → 线上核验。构建失败不会更新已部署的版本；修复原因后重新构建并提交。只在文章确认可公开后放入本仓库。

## 隐私与版权

本仓库只保存原创文章与博客源代码、生成页面及 Marked 第三方许可。不要加入原案例 PDF、完整译本、个人文件或凭据。发布目录从明确的公开输入生成。`check` 提供常见泄漏检测，但不能替代提交前阅读文件清单。

博客没有用户账户、评论、表单服务或访问统计。搜索在本地完成；RSS 阅读器会直接请求静态订阅文件。若以后增加统计，先更新隐私说明，再决定是否收集数据。

原创文章保留权利，转载请联系作者并注明来源。站点第三方解析器许可见 `vendor/LICENSE-marked.md`。引用资料的权利归原权利人所有。

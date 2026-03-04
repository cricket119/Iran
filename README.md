# 伊朗局势实时追踪网站

这是一个可部署在 GitHub Pages 的单页网站：

- 每 20 分钟自动抓取并更新与伊朗相关的新闻 RSS（Reuters、BBC、Al Jazeera、联合早报）。
- 调用 OpenAI API 把标题/摘要翻译成中文并生成简述。
- 同页展示按时间线聚合和按媒体对比视图。
- 独立板块展示 NYT / Foreign Affairs 的评论类内容概括。
- 所有条目都保留原文来源链接。

## 本地运行

```bash
npm install
npm run update
npm run start
# 打开 http://localhost:8080
```

## 部署到 GitHub

1. 创建新仓库并推送本项目到 `main` 分支。
2. 在仓库 `Settings -> Secrets and variables -> Actions` 新建 Secret：`OPENAI_API_KEY`。
3. 在仓库 `Settings -> Pages` 里把 Source 设为 `GitHub Actions`。
4. 首次手动触发 `Update Iran Feed` 工作流（或等待定时任务执行）。
5. `Deploy Pages` 会在 push 到 main 后自动发布。

## 数据结构

生成文件：`data/latest.json`

字段：
- `generatedAt`: 生成时间（ISO）
- `timeline`: 聚合后的新闻时间线
- `bySource`: 分媒体对比数据
- `commentary`: 评论类内容

## 注意

- 某些媒体 RSS 会调整地址或限制抓取，脚本会自动跳过失败源并继续更新其他源。
- 未配置 `OPENAI_API_KEY` 时，页面会显示原文标题和截断摘要（不翻译）。

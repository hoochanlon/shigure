# Timer

无需构建步骤的静态番茄钟。它支持工作与休息计时、中英文切换、自动循环、任务历史和完成铃声。

## 本地运行

ES Modules 需要通过 HTTP 提供服务，不能直接双击打开 HTML 文件。

```bash
pnpm dlx serve
```

打开命令输出的本地地址即可。

## 技术边界

- 原生 HTML、CSS 和 JavaScript ES Modules
- 浏览器 `localStorage` 保存设置、语言和最近 100 条任务历史
- 原生 `HTMLAudioElement` 播放本地提醒音效
- GitHub Actions 将仓库根目录作为静态站点部署至 GitHub Pages

## 数据兼容

首次加载时，应用会读取旧版 `tomatoData` 并迁移为新格式；旧历史记录不会因此丢失。

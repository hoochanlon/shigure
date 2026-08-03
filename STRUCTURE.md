# 项目结构

```text
.
├── .github/workflows/deploy.yml  # GitHub Pages 自动部署
├── audio/
│   ├── rain.mp3                  # 可循环播放的雨声白噪音
│   └── ring.mp3                  # 计时结束提醒音
├── css/
│   ├── base.css                  # 设计变量、重置与全局基础样式
│   ├── layout.css                # 页面外壳、导航与计时主舞台
│   ├── components.css            # 控件、环境设置、面板与历史记录
│   ├── zen.css                   # 禅模式界面与状态覆盖
│   ├── themes.css                # 雨景、Lofi 与深色主题覆盖
│   └── mobile.css                # 窄屏响应式布局覆盖
├── js/
│   ├── audio.js                  # 提醒音与循环环境音的统一控制边界
│   ├── i18n.js                   # 中英文语言包与文本插值
│   ├── main.js                   # 应用状态编排及用户事件绑定
│   ├── storage.js                # 本地数据迁移与持久化
│   ├── timer.js                  # 基于绝对结束时间的计时状态机
│   └── view.js                   # 计时、历史及环境控件渲染
├── wallpapers/rain.jpg           # 全屏雨景背景
├── index.html                    # 静态入口
└── .nojekyll                     # 禁用 Pages 的 Jekyll 转换
```

## 数据边界

- `timer.js` 维护 `idle`、`running`、`paused`、`completed`、`stopped` 状态，不持久化短生命周期计时过程。
- `storage.js` 维护可恢复的用户偏好：时长、自动循环、雨声开关、雨声音量与任务历史，并迁移旧版 `tomatoData`。
- `audio.js` 对提醒声与循环环境声提供同一组播放、停止、音量控制能力。
- `view.js` 只将应用状态投射为页面，不包含业务决策。

`main.js` 是唯一编排层：用户输入先更新状态，再持久化，最后交由视图重绘。页面不依赖 Bootstrap、JX 或 Flash。

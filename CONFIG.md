# 配置文件说明

`js/config.js` 是网站的配置文件，你可以在这里自定义网站的各项设置。

## 配置项说明

### 品牌信息 (brand)

```javascript
brand: {
  name: 'Timer',              // 网站名称，显示在页面左上角
  icon: '⏳',                 // emoji 图标（可选）
  iconSvg: './assets/icons/hourglass.svg',  // SVG 图标路径
  url: './'                   // 品牌链接地址
}
```

### 页面标题 (title)

```javascript
title: {
  default: 'Timer - 专注计时工具',  // 默认页面标题
  work: 'Timer - 工作中',           // 工作模式标题
  break: 'Timer - 休息中'           // 休息模式标题
}
```

### 元信息 (meta)

```javascript
meta: {
  description: 'Timer - 简洁专注的番茄钟与秒表计时工具'  // 页面描述（SEO）
}
```

### 社交链接 (social)

```javascript
social: {
  github: 'https://github.com/hoochanlon/tomato',  // GitHub 仓库链接
  blog: 'https://hoochanlon.github.io',            // 博客链接
  email: 'hoochanlon@outlook.com'                  // 联系邮箱
}
```

### 页脚信息 (footer)

```javascript
footer: {
  startYear: 2026,                           // 版权起始年份
  author: 'Hoochanlon',                      // 作者名称
  authorUrl: 'https://github.com/hoochanlon' // 作者主页
}
```

## 自定义示例

### 更换品牌图标

如果想使用其他图标，只需修改 `iconSvg` 路径：

```javascript
iconSvg: './assets/icons/your-icon.svg'
```

支持的图标位置：
- `./assets/icons/hourglass.svg` - 沙漏图标（当前）
- `./assets/icons/zen.svg` - 禅模式图标
- `./assets/icons/rain.svg` - 雨滴图标
- 或添加你自己的 SVG 图标

### 修改网站标题

```javascript
title: {
  default: '我的计时器',
  work: '工作中 - 保持专注',
  break: '休息中 - 放松一下'
}
```

### 更新联系方式

```javascript
social: {
  github: 'https://github.com/yourname/repo',
  blog: 'https://yourblog.com',
  email: 'your@email.com'
}
```

## 注意事项

1. 修改配置后需要刷新页面才能看到效果
2. SVG 图标路径必须正确，否则会显示默认图标
3. 所有文本字段支持多语言（需配合 i18n 系统）
4. 配置文件使用 ES6 模块语法，确保浏览器支持

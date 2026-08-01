// 网站配置
export const siteConfig = {
  // 品牌信息
  brand: {
    name: 'Shigure',
    icon: '⏳', // 可以是 emoji 或留空使用 SVG
    iconSvg: './assets/icons/hourglass.svg', // SVG 图标路径
    url: './'
  },
  
  // 页面标题 - 现在由 i18n 管理多语言
  title: {
    zh: '时雨 Shigure - 专注计时工具',
    en: 'Shigure - Focus Timer',
    ja: '時雨 Shigure - 集中タイマー'
  },
  
  // 元信息
  meta: {
    zh: 'Shigure 时雨 - 简洁专注的番茄钟与秒表计时工具',
    en: 'Shigure - Minimalist Pomodoro and Stopwatch Timer',
    ja: 'Shigure 時雨 - シンプルなポモドーロとストップウォッチタイマー'
  },
  
  // 时间限制
  limits: {
    pomodoroMaxMinutes: 99,     // 番茄钟最大分钟数
    stopwatchMaxTime: 99 * 3600 + 59 * 60 + 59  // 秒表最大时间（秒）：99:59:59
  },
  
  // 默认设置
  defaults: {
    workMinutes: 25,      // 默认专注时长
    breakMinutes: 5       // 默认休息时长
  },
  
  // 社交链接
  social: {
    github: 'https://github.com/hoochanlon/timer',
    blog: 'https://hoochanlon.github.io',
    email: 'hoochanlon@outlook.com'
  },
  
  // 页脚信息
  footer: {
    startYear: 2026,
    author: 'Hoochanlon',
    authorUrl: 'https://github.com/hoochanlon'
  }
};

export const siteConfig = {
  name: '',
  url: 'https://temaituan.cn',
  ogImage: 'https://ui.shadcn.com/og.jpg',
  description: 'A navigation site powered by Notion databases',
  links: {
    homepage: 'https://tehuituan.cn',
    twitter: 'https://tehuituan.cn',
    github: 'https://tehuituan.cn',
    weibo: 'https://weibo.com/你的微博ID'   // 新增这一行，请将链接换成你的真实微博地址
  }
}

export type SiteConfig = typeof siteConfig

export const META_THEME_COLORS = {
  light: '#ffffff',
  dark: '#09090b'
}

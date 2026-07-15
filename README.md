# 拼豆像素工坊

一个面向拼豆爱好者的高清图纸生成与卡密运营网站。

## 主要功能

- 上传 JPG、PNG、WEBP 图片并生成拼豆像素图
- 支持 MARD、HAMA、Perler 与自定义 CSV 色板
- Lab 色差匹配、渐变柔化、网格与色号标注
- 手动改色、材料数量统计、高清 PNG 与 CSV 导出
- 卡密兑换、次数/有效期控制、卡密管理后台

## 本地运行

```bash
npm install
npm run dev
```

网站使用 Vinext/React，并为 Cloudflare D1 卡密数据库提供迁移文件。生产环境需配置 `DB` 数据库绑定和 `ADMIN_SECRET` 管理密码。

> 注意：GitHub Pages 只能托管静态前端，不能直接运行本项目的卡密 API 与数据库。完整版本应部署到支持 Cloudflare Workers/D1 的运行环境。

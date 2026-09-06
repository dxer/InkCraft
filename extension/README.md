# 墨匠剪藏 · InkCraft Clipper

基于 Vite + React 的 Manifest V3 浏览器插件，将网页正文或选中内容一键保存到墨匠知识库。

## 功能

- **采集正文**：Readability 智能提取 + 站点专属规则，输出 **Markdown**（标题、加粗、链接、列表、表格、围栏代码块）
- **内容站优化**：针对微信公众号（`#js_content` + 懒加载图修正）、知乎（文章/回答/问题）、CSDN（`#content_views`）、X/Twitter 长文做了定向适配，规则未命中时自动回退 Readability
- **采集选中**：只保存页面上选中的文字片段
- **区域剪藏**：进入页内拾取模式后，悬停高亮页面区块、点击即剪藏该区域；拾取与保存都在页内面板（Shadow DOM）完成，不依赖弹窗
- **预览与编辑**：三种模式采集结果均可修改标题与正文后再保存
- **安全接入**：使用「系统设置 → 采集接口」生成的 API Key 鉴权，无需登录会话
- 保存后自动落入**主知识库**，来源 URL 随笔记记录；配置了 AI 时会异步整理标题与标签

## 开发与构建

```bash
pnpm install
pnpm build        # 产出 dist/（popup + content script + manifest）
pnpm typecheck    # TypeScript 类型检查
```

## 安装（Chrome / Edge）

1. 打开 `chrome://extensions`，开启右上角「开发者模式」
2. 点击「加载已解压的扩展程序」，选择本目录下的 `dist/`
3. 打开墨匠「系统设置 → 采集接口」，复制接口地址，生成 API Key
4. 点击浏览器工具栏的墨匠图标，展开⚙配置面板，粘贴地址与 Key，「测试连接」通过后即可使用

## 技术说明

- 双 Vite 构建：popup（React，ESM）与 content script（IIFE，MV3 内容脚本不支持 ES Module）
- HTML → Markdown 使用 Turndown + GFM 插件（表格 / 删除线 / 任务列表）；转换前剔除脚本控件与隐藏元素、修正懒加载图片
- 区域剪藏因 MV3 弹窗点击页面必失焦，拾取框与保存面板由 content script 以 Shadow DOM 注入页面内完成
- content script 由 popup 按需注入（`chrome.scripting.executeScript`），不常驻任何页面；扩展安装前已打开的标签页会自动注入后采集
- 服务端接口：`GET /api/extension/ping`（连通测试）、`POST /api/extension/clip`（入库），鉴权请求头 `X-InkCraft-Key`

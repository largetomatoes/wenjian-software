# 笔记纸交互调整与预览验收

> 后续完成：正文内关键词笔记板已安装至本机，见 [最终完成记录](reading-board-keywords-2026-10-29.md)。本文保留此前阶段的历史记录。

日期：2026-10-28。本轮以 Mac 独立预览交付；正式应用、真实资料库及公开发布未更新。

## 纠正后的交互

阅读顶栏「笔记纸」独立入口；打开后为常驻侧栏。正文为一篇自由连续写作的文稿，不再要求逐个添加思考段。原选文浮层不增加阅读笔记入口。引用通过笔记纸工具栏插在记住的正文光标处，以脚注呈现，可切换为文中原话。点击「梳理联系」后，在正文点选至少两处引用，由用户自行命名和解释；可再次修改、保留原版本、追溯时间。全程不生成思想内容。

## 数据与兼容

composition.schema=1 内新增可选 paper，含 body、带稳定 ID 和 UTF-16 位置范围的 citations、自定义 relations。paragraphs 保留单篇正文的兼容投影。旧段落只读打开时投影为连续文字，实际编辑后才写入 paper。来源仍独立保存原文和定位；引用解除后的联系保留来源快照并标记待核对。

正文编辑采用原生 textarea，透明文字与相同排版的可点击脚注镜像叠合。写作保留原生输入法，编辑状态留在侧栏内部；书页 canvas 不随输入重建。明确保存引用位置，不让新输入自动成为上一条引用的一部分。书中选择文字造成原生输入框 selectionEnd 清零时，保留最后有效笔记光标。

原有草稿、串行保存、失败重试、完整修订与冲突保留机制继续使用。同步与本地写回增加 paper 丢失保护。已适配搜索、成文引用快照、只读导出、万用删除来源、备份恢复。

## 验收结果

- tests/test-reading-paper.mjs：连续正文、指定位置引用、引用前后修改、用户定义关系、重定性时间、解除引用后的快照、完整修订、无效数据。
- tests/test-reading-composition.mjs：旧结构与来源对应兼容、修订、同步冲突及旧端保护。
- tests/test-reading-paper-integrations.cjs：完整备份/恢复与书名冲突、完整草稿、来源解除与修订、旧编辑器降级阻止。
- tests/test-reading-paper-ui.cjs：真实 Mac Electron 与本地保存接口的 10 项主流程；窗口隐藏、虚构资料。
- 原备份与万用删除 18 项测试通过；书籍章节与笔记搜索测试通过。
- npx tsc --noEmit --incremental false --pretty false 通过。
- 预览应用代码签名完整性验证通过。

UI 证据位于 outputs/reading-paper-preview：paper-ui-report.json、paper-and-relations.png、epub-paper.png。

## 交付与限制

预览：outputs/reading-paper-preview/问间·笔记纸预览.app。独立 bundle ID com.wenjian.reading-paper.preview。普通预览资料在应用旁「预览资料」；测试使用 /tmp 独立目录。预览禁用正式更新、云同步与真实 Zotero 操作。

本轮没有替换 /Applications/问间.app，也没有发布 GitHub 或其他平台新包。公开多端同步仍需后续版本联合验证。本版回到原文验证以单书跨页与跨章节为主，跨书导航继续沿用既有对照阅读入口。

# 阅读侧栏笔记本：本地实施与验收记录

> 后续完成：正文内关键词笔记板已安装至本机，见 [最终完成记录](reading-board-keywords-2026-10-29.md)。本文保留此前阶段的历史记录。

> **后续交互调整：** 用户随后要求改为顶栏独立按钮、连续正文、文中脚注与引用之间的自定义联系。新预览及其验收见 [2026-10-28 笔记纸预览](reading-paper-preview-2026-10-28.md)。本页保留此前段落版的历史记录。

> **本机安装补充（2026-10-28）：** 根据用户随后明确要求，已将经过隔离测试的正式应用原位安装到 `/Applications/问间.app` 并重新打开。退出前后备份了真实笔记与草稿，启动后核对笔记文件、已有草稿及本地书籍保持完整，Dock 仍指向原应用路径。旧程序保留于本次安装的独立恢复目录。此次没有公开发布。以下保留原独立预览阶段的实施与测试证据。

日期：2026-10-28。基线提交：a1e08ff。源码：`<工程目录>`。

本地 Mac 独立预览已完成。正式应用与真实资料库保持隔离；本轮未发布安装包或推送 GitHub。预览沿用当前 Mac 运行时构建号，使用独立名称、应用标识和清楚的顶部标识。

## 交付入口

- 预览应用：`<工程目录>/outputs/reading-notebook-preview/问间·阅读笔记预览.app`。
- 使用说明：`<工程目录>/outputs/reading-notebook-preview/开始试用.md`。
- 界面测试结果：`<工程目录>/outputs/reading-notebook-preview/ui-test-report.json`。
- 性能结果：`<工程目录>/outputs/reading-notebook-preview/performance-report.json`。
- 截图：`paragraph-citations.png`、`epub-citations.png`、`performance-ocr.png`。

首次打开预览时，自动使用内置的虚构 PDF、EPUB、过程笔记与 Zotero 批注；正式书籍不会自动导入。资料写在应用旁的“预览资料”文件夹。预览禁用真实云同步和 Zotero 外部操作，导入 PDF/EPUB 后可在此独立环境本地试用。删除整个交付文件夹即可同时移除预览程序、其内含 Helper 和预览资料。

## 已实现

1. 复用“本书笔记”非模态侧栏，连续编辑；每条笔记有可选标题、多个思考段和独立来源池。
2. 每个思考段明确引用零、一或多个来源。同一来源可被不同段落、不同笔记复用。
3. “加入阅读笔记”接收当前选文，不依赖 Shift；已有高亮、过程笔记、Zotero 批注可从来源选择器引用。
4. 引用标记支持悬停原文提示、点击展开、章节编辑、摘录校对及回到原文；原有注解与书中原文分开保存。
5. PDF 单页和连续阅读、EPUB 跨章节均可继续书写，支持回到原文后返回此前阅读处。
6. 来源记录使用稳定身份和位置；PDF 同页重复句子按保存的矩形位置恢复；Zotero 来源保留引用时的位置快照。
7. 侧栏可拖宽、独立滚动、收起后保留当前编辑。换书清理旧来源请求，防止来源串到新书。
8. 正文及引用自动保存；约 300ms 保存本地草稿、稳定停顿约 1.5s 提交正式记录；串行保存、失败重试、退出阅读与应用更新准备均等待落盘。
9. 直接修改、引用增减、段落重排、撤销与重做；历史保留完整结构、原文来源和时间，恢复生成新版本。修改原因选填。
10. 本地编辑冲突保留完整草稿，可核对另一版本，或把当前草稿另存成一条新笔记。
11. 搜索可打开具体思考段；章节入口引用同一条笔记；关联问题继续沿用既有选择器。
12. 整理成文可选择具体思考段，并携带该段的原文快照；来源改变可识别；只读导出保留引用对应关系。
13. 解除侧栏引用保留原高亮与原笔记；万用删除、删书后的出处身份、历史恢复和完整备份均已适配。
14. 旧笔记只读打开时仅在内存投影，实际编辑后才升级为段落结构；旧共同思考保留整体引用，不猜测内部关系。
15. 新结构同步采用整条笔记冲突保护；对旧端改正文却保留旧结构、或移除段落结构的写回予以阻止，保留本地与云端原操作记录。

## 工程阶段

| 阶段 | 结果 |
| --- | --- |
| P0 基线 | 正确源码、干净基线、虚构书籍与隔离资料库 |
| P1 数据与兼容 | composition、来源池、0/1/N 引用、投影、完整修订、旧数据不自动改写 |
| P2 侧栏写作 | 局部编辑状态、草稿与正式保存分层、宽度与独立滚动 |
| P3 来源加入 | 选文、已有高亮、过程笔记、Zotero 批注；来源复用与去重 |
| P4 导航 | 单页/连续 PDF、EPUB、阅读返回、书页反向引用入口 |
| P5 联动 | 章节、搜索、成文、导出、删除与备份；模拟同步及旧端写回保护 |
| P6 体验 | 桌面实测、保存故障、历史恢复、同页重复句、OCR 与大量资料测试 |
| P7 交付 | 独立 Mac 预览与本文档；正式替换与公开发布尚未进行 |

## 验证命令

已执行并通过：

```text
npx tsc --noEmit --pretty false
node tests/test-reading-composition.mjs
node tests/test-desktop-comparison.mjs
node tests/test-book-notebook-updates.mjs
node tests/test-device-sync.mjs
node tests/test-sync-client.mjs
node tests/test-organization-archives.mjs
node tests/test-pdf-crosspage-sync.mjs
node --test tests/test-book-reading.cjs tests/test-sync-revision.cjs tests/test-complete-backup.cjs
node work/mac-app/scripts/build-mac.mjs --prepare-only
node scripts/build-reading-notebook-preview.mjs --refresh
PLAYWRIGHT_MODULE=实际Playwright路径 node tests/test-reading-composition-ui.cjs
PLAYWRIGHT_MODULE=实际Playwright路径 node tests/test-reading-composition-performance.cjs
codesign --verify --deep --strict 预览应用路径
```

UI 使用真正的 Mac Electron 预览应用及本地读写 API，窗口隐藏运行，未使用真实笔记。通过 12 项流程：

- A, A+B, B+C are mapped to three distinct paragraphs in the real desktop save API
- Typing and saving retain the reading canvas
- Page 8 source navigation and return keep the live side editor
- New page selection joins the active paragraph without multi-page selection modifiers
- Paragraph order and the full draft survive page reload
- Formal save failure retains complete source-aware draft; explicit retry saves it
- History restores paragraph order, original wording and citation mapping as a new version
- Collapsing the sidebar preserves the current editor
- Existing process notes and Zotero annotations are referenced without mixing their comments into the source quote
- Identical text at two positions is restored to the selected lower passage, not the first text match
- Continuous PDF source navigation uses the same live side notebook
- EPUB selections from two chapters join one paragraph with stable CFI ranges and chapter labels

数据层另行验证：未读写迁移的旧笔记、A/B/C 映射、几何锚点去重、同页同文不同位置、0/1/N 来源、修订、顺序、冲突、旧端丢字段保护、来源与删书维护、成文出处变化、HTML 转义及备份重名文件恢复。

## 性能记录

机器：Apple M5，16GB 内存；视窗 1280×800。

- 200 页 PDF，100 条笔记，合计 500 个来源。
- 活动笔记 20 个来源、6 个章节，兼容正文 11804 字符。
- 输入期间采样 184 帧，P95 帧间隔约 17.2ms，超过 50ms 的长帧 0 次。
- 正式保存 2 次；输入与保存保留原 PDF canvas 实例。
- 扫描页自动 OCR 完成时笔记仍可编辑。
- JS 堆约 23.1MiB。各 Electron 进程的工作集快照保留在 JSON 中；它与 JS 堆不同，含原生渲染和 OCR 占用，不能据此宣称整个应用只占这么多内存。

这些是本机场景的测量结果，没有做旧版同场景的定量基线对照，也不代表 Windows 轻薄本或所有书籍的性能。

## 范围与后续边界

- 本轮完整交互验收以 Mac 为主，未制作/发布 Windows、Android 或 iPhone/iPad 新版本。
- 未连接真实坚果云做上线联调。旧客户端写回新段落笔记会触发保护，需要后续多端兼容版本一起验证后再正式开放。
- 新侧栏的“原文往返”本轮完成单书跨页、跨章节；跨书自动切换仍使用既有对照阅读入口，新侧栏会给出来源属于另一本文献的提示。
- 缺失/无效的定位不能保证恢复到精确字句；摘录快照与自己的思考继续保留。
- 自动保存仅保证已完成的写入；突然断电仍可能丢失最后尚未落盘的一瞬输入。

## 接手继续开发

源码工作树保留本次改动。新主模块：`lib/reading-composition.cjs`、`lib/pdf-source-range.ts`、`lib/reading-zotero-source.ts`、`components/book-note-editor.tsx`。请先查看 `git diff` 与本报告，再处理余下跨书侧栏导航或多端正式发布，避免重做已完成部分。

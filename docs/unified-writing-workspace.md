# 按书目查笔记的统一文稿入口

2026-11-03。本机 Mac 在 3.1415（347）基础上的本地调整，版本清单未变，此次没有进行跨平台发布或 GitHub 推送。

## 使用路径

主界面点击“文稿”，切换“阅读笔记”或“我的文稿”。默认继续上次的窗口位置。

- 阅读笔记：左侧选书目，中间按标题浏览与搜索，右侧直接继续写笔记板，无需先加载原书。窄窗口使用书目下拉框。
- 同一篇共同笔记可以从相关书目进入，保留同一个记录 ID。没有摘录、没有关联问题的正文也完整列出。已移除原书的笔记放在“未归属书目”。
- 主题继续作为筛选条件，切换书目不会取消已选主题；章节放在更多筛选。过程笔记、高亮和 Zotero 摘录在“摘录与批注”中按需展开。
- 点击正文中的来源或“打开原书”，保存当前编辑后返回对应阅读位置。书内仍以“写笔记”为主入口，查找收进笔记板内部。
- “我的文稿”保留原来的写作、句子关联和整理成文。整理成文补上笔记本身的书籍归属，没有摘录的思考也能选入；选入的是原话及来源快照，不移动原笔记。

## 保存与同步版本核对

统一窗口复用原有 `BookNoteEditor` 和阅读窗格草稿命名，切换书目、切换用途和关闭前刷新当前编辑。正式记录继续使用原有按记录保存、历史保留和失败恢复机制，没有创建第二套笔记数据。

文稿保存记住编辑开始时的完整版本。收到其他版本后，保存不会把当前 props 误认为原始编辑基准。用户可以：

1. 将当前草稿另存为新文稿，保留已同步文稿；
2. 打开同步版本，先将本机编辑保存到该文稿的“保留的草稿”中，之后可以重新载入；
3. 明确采用当前草稿继续，再保存。另一版本成为修改历史。

原始版本核对包含内容、标题和历史，不只比较时间戳。草稿写入期间又收到更新时也会再次核对，父级保存还携带明确的基准供三方合并校验。切换窗口期间如正在正式提交，会等待该提交及草稿队列结束。

## 回归中补修的问题

旧笔记经过稳定 JSON 存储后，对象字段顺序与编辑器生成顺序不同，原 `validatePaper()` 使用 `JSON.stringify()` 对比段落，导致内容相同也误报“笔记板正文与脚注不一致”，影响目录改标题等操作。

现在用已有的语义 JSON 比较，忽略对象键顺序，同时保留数组顺序、正文和引用校验。测试覆盖读取后的重排对象键、修改标题保留正文和来源、真实段落正文不一致以及来源数组顺序错误。

## 主要文件

- `components/writing-workspace.tsx`、对应 CSS：统一窗口、书目列表、阅读笔记和文稿切换。
- `components/book-note-directory.tsx`、`book-note-editor.tsx`、`library-reader.tsx`：共用目录、直接写作和书内查找入口。
- `components/manuscripts.tsx`、`lib/manuscript-version.ts`、`app/page.tsx`：原始版本核对、冲突选择、草稿恢复和带基准的保存。
- `lib/manuscript-materials.ts`：补齐材料所属书籍、章节和来源显示。
- `lib/reading-paper.cjs`：段落语义校验。
- `components/usage-guide.tsx`、`update-highlights.tsx` 和虚构资料截图：设置说明与一次性带图演示。

## 验收

- 统一工作区原生交互 14 项通过：书目与标题查找、同一笔记继续写、位置恢复、立即切换保住最后输入、多书共同记录、主题与折叠批注、失去原书后的编辑、窄窗口、整理成文、三种冲突处理、提交期间的新版本、返回原书、全局搜索和图示演示。
- 原书内目录交互 9 项通过，包含读取后改标题、主题和章节筛选、触控板滚动、重新打开。
- 原 PDF／EPUB 笔记板交互 12 项通过，包含真实拖拽、脚注、关系修改、历史、重启和失败重试。
- 保存、历史和架构备份的 28 项自动测试通过；材料选入、文稿版本、目录及完整备份、脚注和段落模型的模块测试通过。
- 主工程、移动共享代码与 Web 共享代码 TypeScript 检查通过。Mac 候选包签名验证通过。

所有交互验收使用单独的虚构资料目录并禁用外部连接，没有访问真实云端。新增图示只包含虚构书目和文字。安装与真实资料核对结果单独记录在本地交付目录，不加入仓库。

## Follow-up edge-flow regression (2026-11-03)

The local follow-up fixes three reproduced integration bugs: new manuscript duplication after committed responses are lost; opening a second-book source without continuing the originating shared note; and parent close flushing a discarded draft back into active storage. Creation identity and authored candidate content are persisted before submission. Retry and restart reconcile that same creation, and newer typing stays a draft of the same record. Discarded wording remains in recoveries without being reactivated.

Topic and chapter filters expand inside the scroll column. Routine highlight pending strips and save/color success feedback are suppressed, while failed marks retain their warning, preserved draft and retry action.

Validation: 9 new isolated native edge-flow checks, 14 existing workspace UI checks, 31 save/model/backup tests, TypeScript and the Mac build/signature check passed. See tests/test-writing-workspace-edge-ui.cjs. The read/Zotero folder sidebar redesign is still a visual proposal; it is not implemented in this patch. No installed application replacement or remote release occurred.

# 问间插件开发与投稿

## 内置万用删除（3.141）

设置的“插件”中提供默认关闭的内置“万用删除”。开启后，问题、卡片、书籍、文件夹、笔记、修订等位置显示删除按钮；PDF 和 EPUB 高亮可在原文处点选处理。

集中管理按问题页、书名与章节、卡片类型和标签、文稿、分类收纳、历史归档查找。同一条共同笔记在不同来源中指向同一条记录。“仅移出本页”保留原件；删除原记录会先列出跨页影响。

这是宿主维护的内置功能，不会向普通第三方插件开放任意宿主 API。确认后先保存本机恢复副本，以版本检查防止误覆盖；只有阅读进度的独立变化允许安全重算。暂停、停用会撤销待确认删除。恢复在相关内容后来发生变化时停止，不直接覆盖新工作。

删除不抹除旧备份或 Zotero 原件。书籍文件保留供恢复，独立读书笔记保留来源文字。删除 Zotero 文献或分类后，来源联动不再立即导入；恢复后可重新接收。删除默认根问题前，请将参与同步的所有设备升级到 3.141。

3.141（内部构建 336）在 Mac 和 Windows 提供可编程插件 SDK v2；安卓和 iPhone/iPad Web App 提供 v1 外部工具与内置万用删除，不运行桌面沙箱或本机命令。插件完全可选，不默认安装、不内置 AI 服务。开发者用示例数据即可开发，无需索取使用者的私人资料。

## 选择接入方式

- **v1 外部工具**：复制阅读选文并打开网页/本机服务，由用户自行粘贴。不执行插件代码、不读整库。旧接入包继续兼容。
- **v2 可编程插件**：在自己的沙箱窗口运行 HTML/CSS/JavaScript，通过 SDK 读取授权资料、绘制问题图、保存独立布局、提出编辑/整理/归档/清除、连接本机模型、导入导出文本。
- **高级本地扩展**：v2 声明 `system.execute`，用户另外启用高级模式、信任程序并在原生选择器中指定命令行可执行文件。该程序拥有操作系统赋予的访问能力，可能读取其他文件、联网、修改电脑。普通插件沙箱不能约束它，问间无法保证其行为。不得把高级模式称作安全的普通插件。

## 接入包

UTF-8 JSON 文件，扩展名 `.wenjian-plugin`，不是 ZIP，最大 1 MiB。不使用远程 CDN、npm 动态依赖或外部脚本；需要的前端库应合并到 JS 包中并保留许可证。

```json
{
  "format": "wenjian-plugin",
  "schema": 2,
  "manifest": {
    "id": "org.example.my-graph",
    "name": "自己的问题图",
    "author": "作者",
    "description": "在独立视图中展示所选问题页，不修改原始结构。",
    "version": "1.0.0",
    "apiVersion": 2,
    "minAppBuild": 333,
    "kind": "sandbox",
    "platforms": ["mac"],
    "permissions": ["graph.read", "storage"],
    "network": {"local": [], "remote": []},
    "license": "MIT"
  },
  "view": {
    "html": "<button id='load'>读取问题图</button><pre id='out'></pre>",
    "css": "#out{white-space:pre-wrap}",
    "js": "document.querySelector('#load').onclick=async()=>{document.querySelector('#out').textContent=JSON.stringify(await wenjian.graph.read(),null,2)};"
  },
  "readme": "工具用途、权限理由、数据处理、使用方法、联系方式和修改记录。"
}
```

运行 `node plugins/validate.cjs 接入包路径 336 mac` 检查格式与 SHA-256；末项可选 `mac`、`windows`、`android`、`web`，须与实际支持的平台一致。移动端仅支持 v1，不应把依赖桌面程序的工具声明为移动端可用。`plugins/examples/` 内是可直接安装的虚构用途示例，不会自动上架市场。

## 使用者如何授权

设置 → 插件 → 从文件安装 → 核对作者、版本、声明权限与说明 → 安装。

已安装 → 启动与授权 → 选择问题页、书籍或卡片集，以及本次允许的能力 → 原生窗口再次核对 → 启动。安装本身不授予任何笔记读取权限。关闭窗口、停止、停用、卸载或更新会撤销运行授权；每次重新启动重新选范围。一个插件一个窗口，最多三个同时运行。插件不自动随问间启动、不随坚果云同步安装。

问题页授权包括该页中的问题、交叉思考、相关过程笔记、读书思考、引用与关联文稿。书籍授权包括该书笔记与批注，不包括 PDF/EPUB 文件。卡片集需明确勾选。已归档内容另行勾选。数据不沿跨页关系自动扩展；范围外的关系端点可保留 ID，但不额外返回标题和正文。真实记录中本来写下的引用属于该记录的内容，不尝试自动识别/删改用户文字。

## 权限

- `notebook.read`：读取范围内的记录与历史。
- `graph.read`：读取范围内的图节点、父子和交叉关系。
- `notebook.write`：提出新增、编辑、关联和页面位置调整。
- `notebook.archive`：提出归档和恢复。
- `notebook.delete`：提出清除卡片、过程笔记、读书思考、高亮等可清理记录。为保留被引用的原件，问题、交叉思考和书籍仍使用归档；根问题使用主程序的问题页归档入口。
- `storage`：保存插件独立的布局、结果和设置，最多 1 MiB，不进入笔记同步。
- `network.local`：通过宿主访问声明的本机 HTTP 服务。
- `network.remote`：通过宿主访问声明的远程 HTTPS 服务。
- `files.read` / `files.write`：通过原生选择器读取或导出用户指定的文本文件，最多 8 MiB，不提供任意路径访问。
- `system.execute`：高级模式下运行用户另行选择的可执行文件，风险见上文。

普通插件无 Node、文件系统、任意 IPC、直接网络、弹窗、子框架、下载和系统设备权限。独立窗口/session 与主界面不共享内部 API 身份。网络访问必须走宿主代理；声明权限本身并不授权，启动时还要由用户勾选。

## SDK v2

所有方法返回 Promise。`window.wenjian` 提供：

```js
await wenjian.info();                 // 本次权限和范围，不含同步凭据或文件路径
await wenjian.notebook.read();        // {schema:2,version,scope,data}
await wenjian.graph.read();           // {schema:2,version,nodes,edges}
await wenjian.storage.set('layout', {spacing: 160});
await wenjian.storage.get('layout');
const preview = await wenjian.changes.preview(operations, '修改原因');
await wenjian.changes.apply(preview.token); // 原生确认、版本检查、备份、事务提交
await wenjian.files.open();           // {name,text} 或 {cancelled:true}
await wenjian.files.save('结果.md', '# 结果');
await wenjian.network.request({url:'http://127.0.0.1:11434/api/generate',method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'用户已安装的模型',prompt:'用户授权的内容',stream:false})});
await wenjian.system.run(['程序参数'], '只传给所选程序的标准输入');
```

SDK 类型见 `plugins/sdk.d.ts`。本机模型由使用者自己安装和运行，问间不下载或附带模型。模型服务自身是否还访问其他服务，由该服务负责；仅接入本机地址不能证明服务的推理也完全离线。

`network` 只声明 origin，例如 `http://127.0.0.1:11434`、`https://api.example.org`，不带路径、尾斜杠、用户名密码。请求只能访问已授权的声明地址，禁止重定向、访问问间内部端口。超时 60 秒、请求体 1 MiB、返回 2 MiB。结果为 `{status,contentType,body}`，`body` 是字符串。无自动凭据转发；如需第三方 API 密钥，由插件自己向用户说明并管理，不读取问间同步账号。

快照去除真实书籍文件路径、云端文件键、同步连接、服务标识和 OCR 整库。最多返回 8 MiB，超出时请让用户缩小范围。`graph.nodes` 的 `id` 是稳定记录 ID，`key` 是当前问题页中的位置标识。同一个原始问题可在不同问题页有不同 `key` 和编号；不要把显示编号当作记录 ID。边同时提供 `from/to` 记录 ID 和可用的 `fromKey/toKey`。`external:true` 表示范围外端点，无权展开读取。

## 提交修改

一次 1—50 项，必须说明原因。宿主预览令牌有效十分钟、只能使用一次；原生确认后如果资料版本已变，整批拒绝并要求重新读取/预览。未经确认不能写笔记，不接受直接覆盖 notebook JSON、历史、身份或来源原文。

```js
const operations = [
 {action:'update',kind:'question',id:'记录ID',patch:{body:'自己的新表述'}},
 {action:'create',kind:'question',pageId:'页ID',parentId:'上级记录ID',title:'新子问题',body:''},
 {action:'create',kind:'card',text:'新点子',cardKind:'idea'},
 {action:'create',kind:'reading',libraryBookId:'书籍ID',text:'读书思考',questionIds:[]},
 {action:'cross',pageId:'页ID',anchorIds:['问题A','问题B'],title:'共同思考',text:''},
 {action:'link',from:'记录A',to:'记录B',type:'关联'},
 {action:'move',pageId:'页ID',recordId:'问题ID',parentId:'新上级ID'},
 {action:'include',pageId:'目标页ID',sourcePageId:'来源页ID',recordId:'问题ID',parentId:'放入位置ID',withChildren:true},
 {action:'archive',kind:'card',id:'记录ID'},
 {action:'restore',kind:'card',id:'记录ID'},
 {action:'purge',kind:'card',id:'记录ID'}
];
```

这是操作格式示意，不应把互相冲突的示意项目一次全部提交。支持更新的字段：question 为 title/body/origin/source；cross 为 title/text/origin/source；card 为 text/origin/source/kind/tags；process 为 interpretation/questionIds；reading 为 text/questionIds；manuscript 为 title/body。改动正文会由宿主补充旧版本、时间和插件/原因，创建时间与引文保留。结构整理使用页面位置，不改变原问题的原始归属。

清除由宿主处理引用、后续思考和归档标记，不能删除书籍原件。编辑与清除进入正常资料版本，沿用现有同步冲突处理；离线修改会在后续同步捕获。不会为绕开冲突而静默覆盖其他设备。旧备份、已同步的历史和云服务回收站可能仍包含原内容，不承诺擦除所有历史副本。

设置 → 插件 → 操作记录可恢复每次修改，相关记录后来又被编辑时停止自动恢复；无关的后来修改保留。每次写入前有私密完整 notebook 快照和变化记录；文件夹可从此处打开，不提供给插件读取。

## 运行和卸载

关闭窗口即停止；管理页可停止并撤销授权、暂停所有插件、启停或卸载。插件不自动后台运行。独立设置可单独清除；卸载保留笔记和恢复记录。普通插件每个最多四个并发请求、每十秒 120 次请求；高级程序一个并发任务、超时 120 秒、输出 2 MiB，关闭窗口终止所在进程组。高级程序仍可能自行启动不受控的外部程序，因此不是完整系统隔离。

## 投稿与审核

在 https://github.com/largetomatoes/wenjian-software/issues/new 提交插件投稿，或提交 PR。提供：

1. 名称、稳定 ID、作者、功能、截图和使用方式。
2. 公开接入源码地址、许可、第三方依赖许可和对应构建步骤。
3. 接入包固定版本下载地址、版本、修改记录、SHA-256、兼容平台和最低内部构建。
4. 各项权限理由、本机/远程地址、是否收费、数据如何处理；是否调用高级本机程序。
5. 虚构测试资料；不提交真实笔记、账户、密钥或私人文件。

维护者核对源码和包、测试范围限制/写入确认/停用卸载/恢复后，才加入 `plugins/catalog.json`。目录使用 `{schema:1,apiVersion:2,plugins:[...]}`，每项为 `{id,name,author,description,version,minAppBuild,platforms,url,sha256}`。安装包来源为固定 GitHub Releases 版本或 raw 地址，HTTPS，校验值为小写 64 位 SHA-256。更新须重新审核，不用“最新版”链接替换已审内容；审核和开源不等于绝对安全。

作者保留署名并单独声明插件许可。问间接口以通用能力开放，AI 是否使用由用户自行选择，不自动替用户生成思想或修改关系。

## v1 兼容包

```json
{"format":"wenjian-plugin","schema":1,"manifest":{"id":"org.example.external-tool","name":"外部工具","author":"作者","description":"复制选文并打开工具，由用户自行粘贴。","version":"1.0.0","apiVersion":1,"minAppBuild":332,"kind":"external-tool","platforms":["mac"],"permissions":["external.open","selection.read","clipboard.write"],"launch":{"mode":"copy-selection-and-open","url":"https://example.org/"},"license":"MIT"},"readme":"工具说明"}
```

`launch.mode=open` 只需 external.open。v1 仍从 PDF/EPUB 选文更多操作调用，不取得 v2 的读库或写入能力。

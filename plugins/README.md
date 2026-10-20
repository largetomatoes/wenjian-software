# 问间插件接口 v1

此版本先支持声明式的外部工具接入，不运行第三方 JavaScript、Node.js 或原生二进制。开发者无需修改问间源码。插件在用户主动使用时打开外部工具；只有明确选中并调用的文本可被复制。接口不提供笔记写入、整库读取、书籍文件、同步凭据或自动上传能力。

## 接入包

创建 UTF-8 JSON 文件，扩展名 `.wenjian-plugin`。它是 JSON 接入包，不是 ZIP。示例域名应替换为开发者实际工具入口；示例不会进入市场或默认安装。

```json
{
  "format": "wenjian-plugin",
  "schema": 1,
  "manifest": {
    "id": "org.example.external-tool",
    "name": "外部工具名称",
    "author": "插件作者",
    "description": "复制主动选中的片段，并在浏览器打开外部工具。",
    "version": "1.0.0",
    "apiVersion": 1,
    "minAppBuild": 332,
    "kind": "external-tool",
    "platforms": ["mac"],
    "permissions": ["external.open", "selection.read", "clipboard.write"],
    "launch": {"mode": "copy-selection-and-open", "url": "https://example.org/"},
    "license": "MIT",
    "homepage": "https://example.org/"
  },
  "readme": "这里填写工具用途、使用方式、外部服务的数据处理方式和作者联系方式。"
}
```

`launch.mode=open` 仅打开工具，权限只需 `external.open`。`copy-selection-and-open` 复制用户当前选文，再打开工具，由用户自行粘贴；问间不会把选文写入 URL、请求服务器或写回笔记。HTTPS 和本机 HTTP 入口可用，脚本、文件 URL、自定义 shell 命令、用户名密码 URL 不接受。

接口版本与问间的圆周率显示版本分开；`minAppBuild` 使用内部整数构建号。插件更新保留同一个 ID，并提升三段版本号。增加权限时会重新展示安装确认。首版仅承诺 Mac。

## 用户流程

设置 → 插件 → 从文件安装 → 查看作者、版本、权限与说明 → 安装。市场可加载已审核目录，安装文件同样校验 SHA-256。已安装页可启用、停用和卸载。卸载不删除任何笔记，停用后不会调用工具。插件本身不进入坚果云笔记同步，每台设备自行安装。

选中 PDF/EPUB 原文 → 选文更多操作 → 选择启用的外部工具。选文动作只传递所选文本，不自动传递笔记、文件路径或书名。插件没有后台常驻进程。

## 投稿与目录

在 https://github.com/largetomatoes/wenjian-software/issues/new 提交：插件名、ID、功能和截图、作者、接入源码仓库、许可、兼容平台/最低构建、权限及理由、外部服务的数据处理说明、版本更新记录，以及 `.wenjian-plugin` 安装包链接和 SHA-256。

维护者核对接入源码、声明和安装包一致性，在虚构笔记上测试安装、启停、调用和卸载后，才加入 `plugins/catalog.json`。目录每项为 `{id,name,author,description,version,minAppBuild,platforms,url,sha256}`。`url` 为 GitHub Releases 的固定版本安装包或 GitHub raw 文件，必须 HTTPS，SHA-256 为小写 64 位十六进制。

更新必须提交明确的新版本和校验值，不以“最新版”链接替换审核内容。目录不是任意代码运行入口。作者保留署名，插件许可单独声明；外部服务是否开源、是否收费应写清。请勿把自己的账号、密钥或笔记放进接入包。

## 宿主端接口

- `GET /api/plugins`：本机已安装记录和内置目录。
- `GET /api/plugins?refresh=1`：手动刷新官方目录；不可用时保留本机目录与已安装记录。
- `POST /api/plugins`：`action=import` 由原生文件选择器读取接入包，或 `action=preview-market,id` 预览目录安装包。
- `action=install,token`：确认预览后安装。
- `action=enabled,id,enabled`：启停；`action=uninstall,id`：移除接入包。
- `POST /api/plugins/invoke`：`{id,text}`，由宿主选文菜单在用户点击后调用。只允许已启用、版本兼容的插件。

以上本机端点校验请求来源；不是可供外部网页扫描整个问间资料库的接口。外部工具作者只需要提交声明包，不需要获取宿主凭据。

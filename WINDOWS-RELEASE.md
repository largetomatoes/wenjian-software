# Windows 3.14（321.1） / build 322

本次仅发布 Windows x64；Mac、Android 和桌面演示版没有重新打包或替换。

## 对应源码与修改记录

源码基线为 `17ec49553d16af3b9a320d3bc33a6d434f00c43e`。本次整合 2026-10-18 Windows 交付补丁（原测试构建 325），并按正式发布规则重新构建为内部 322。原交付文件没有覆盖或重命名冒充新版。

- PDF 先预览后清晰化，页面与预览缓存有大小上限。
- 当前扫描页就绪后约 650ms 开始识别；滚动与输入不会取消当前页 OCR。换页、旋转、换书、隐藏窗口、关闭阅读或关闭自动识别时取消旧任务。
- 保留 Windows OCR worker 复用、空闲释放、后台像素处理与专用 LSTM 语言模型；不降低识别分辨率。
- 长阅读笔记列表虚拟化，减少不必要的界面状态复制与重复渲染；非紧急后台工作向阅读让行。
- 第一次关闭时选择托盘或退出；托盘恢复现有窗口，实际退出继续检查草稿与保存。没有删除草稿保护。
- 安装向导增加目录选择和目录保护；安装脚本显式 UTF-8，采用独立安装图标。
- 显示修订 `321.1` 与内部构建 `322` 分离；整数用于版本比较、签名、校验与安装确认。
- 新版更新发现按发布的平台元数据筛选。旧 321 能发现本次 Windows 更新，但第一次提示仍可能显示内部 322。

## 版本配置

`work/mac-app/windows-release.json` 是 Windows 发布配置。Mac 共用的 `asar-src/package.json` 继续保留 build 321，避免下一次 Mac 打包被动变成 Windows 修订。

- 产品版本：3.14
- 显示修订：321.1
- 内部构建：322
- Windows EXE 包版本：3.3.2
- Release 标签：v3.14-build322

不支持从本地未公开测试构建 323–325 自动降级。若安装过该测试版，先导出完整备份并从托盘退出；可卸载测试程序后安装正式版（卸载保留 AppData 资料），或使用解压到独立目录的 ZIP。勿删除个人资料目录。

## 构建

需要 Node.js 22.13 或更新版、Python 3、NSIS Unicode 和当前平台可用的 sharp。Electron Windows x64 runtime 由打包器获取；跨平台构建时也可用 `WENJIAN_ELECTRON_ZIP_DIR` 指向已有官方 ZIP 缓存。

```sh
npm ci
npm ci --prefix work/mac-app
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.desktop.json
node tests/test-app-updates.mjs
node tests/test-windows-performance.mjs
node tests/test-windows-reader-scheduling.mjs
node tests/test-ocr-cache.mjs
node tests/test-reader-text.mjs
node tests/test-app-updater.cjs
node work/mac-app/scripts/build-windows.mjs
```

可选环境变量：`MAKENSIS`、`PYTHON`、`WENJIAN_WINDOWS_OUTPUT_DIR`、`WENJIAN_ELECTRON_ZIP_DIR`。`WENJIAN_WINDOWS_BUILD` 只供额外测试覆盖；正式发布直接使用配置文件。

构建器生成安装 EXE 和按构建号命名的更新 ZIP。安装器读取本次 Windows stage 的清单，不读取 Mac 的构建号。不要只改下载文件名。

## 应用内更新

发布正文保留机器可读元数据：

```html
<!-- wenjian-build:322 -->
<!-- wenjian-display-build:321.1 -->
<!-- wenjian-platforms:win32 -->
```

签名清单 schema 1 中的 version、build、tag、平台、ZIP URL、字节数和 SHA-256 必须与实际发布对应。用 `scripts/sign-desktop-release.mjs` 签署 payload；私钥通过 `WENJIAN_UPDATE_SIGNING_KEY` 指向仓库外文件，绝不随源码、日志或安装包发布。工具会确认其匹配旧版内置公钥。

发布附件包括 `Wenjian-3.14-build322-Windows-x64-Setup.exe`、`Wenjian-3.14-build322-Windows-x64.zip`、`update-manifest-322.json`、源码 ZIP、校验文件与验证记录。

旧 Mac / Android 321 的发现逻辑尚不理解平台元数据，可能显示本次未提供该平台安装包；继续使用原版即可。不要把旧包改名为 322，或让其他平台安装未经重建的旧包。

## 验证边界

上游提供了 Windows 10/11、Ryzen 7 4800H 的测试记录，覆盖连续滚动 OCR、输入、扫描缓存、长笔记与安装包。本轮在 Mac 隔离目录重新构建，核对安装器和 ZIP 内全部文件哈希、UTF-8、空白资料库和签名，Windows 运行验证参考上游已经完成的实机测试。最终 322 包的远程 Windows 复测按使用者要求停止，没有把未完成的检查记为通过；本轮完成的范围与上游记录见 Release 附件 verification-322.json 和 upstream-verification-322.json。

性能数据不应推广为所有 Windows 电脑上的速度或内存保证。真实坚果云网络速度未做本轮性能评测。完整桌面类型检查使用 `tsconfig.desktop.json`；独立 Web App 托管代码不属于本次 Windows 构建目标。

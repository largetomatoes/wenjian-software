# 问间 3.141（343）统一发布工作表

以已安装的 Mac 阅读笔记板、关键词引用与联系说明为功能标准。公开最高版本为 342，因此本版统一构建号 343；桌面身份、Android 原签名、Web App 原域名与资料存储继续沿用。

|阶段|内容|状态|
|---|---|---|
|1|核对最高构建、更新保护与原签名|已核对|
|2|Windows 接入 Mac 全部功能，保留 OCR/字体/托盘/磁盘选择/GPU 偏好|已完成|
|3|Android 手机入口、触控引用、笔记板、同步与演示|已完成|
|4|iPhone/iPad Web App、横竖屏、离线更新保护|已完成|
|5|跨端保留笔记、原文位置、联系与完整历史；虚构资料回归|已通过|
|6|构建 Mac/Windows/Android/PWA；安装与空白资料验证|已通过，冻结代码 688a233|
|7|源码、签名清单与独立 GitHub Release|已正式发布，9 个文件校验一致|
|8|官网、原 Web App 及本机更新时机|官网和 Web App 已更新；按使用者要求保留当前阅读，不替换本机|

经使用者确认，桌面安装包去除 Manual 后缀，恢复标准名称，同步重签更新地址并刷新发现索引。Mac 341 独立真实副本升级到 343 已通过（图标、旧应用和虚构笔记均保留）；Mac 341、Windows 342 的原发现器均识别 343。更早故障安装器的代码不会因服务端改名而修复，保留下载覆盖安装入口。

本机没有 Android SDK/JDK；优先使用 GitHub 标准构建机已有 SDK 生成未签名包，再用本机原密钥离线签名，私钥不上传 CI。iPhone/iPad 发布沿用 Web App，不宣称 App Store 或真机验收。Windows CI 与浏览器模拟检查分别报告实际范围。

## 验证回执

- Android 原生 release 编译及单元任务：[40824142843](https://github.com/largetomatoes/wenjian-software/actions/runs/40824142843)，通过。只在 CI 生成对齐未签名包，再在本机使用原证书签署，v1/v2/v3 签名与证书指纹一致。
- Windows 实际安装、覆盖、失败回滚、旧 339 升级及数据保留：[40824912425](https://github.com/largetomatoes/wenjian-software/actions/runs/40824912425)，全部通过。
- Mac 最终包的 12 项阅读流程和 7 项操作/同步/演示流程通过。
- Chromium 手机尺寸、持久化 WebKit iPhone/iPad 的笔记板与横竖屏流程通过；旧 Web App 342 从原界面更新到 343 后，卡片、未提交草稿及离线重开通过。
- 完整备份与恢复 18 项、移动存储适配 12 项、Windows 资源与 GPU/OCR 策略 6 项及跨设备同步回归通过。
- 桌面归档为空白资料，未包含私人笔记、原书、草稿或签名密钥；Windows UTF-8 与 Finder 元数据清理检查通过。

平台实际验收范围：Windows 云端测试机；Mac 本机独立虚构资料；手机和平板为浏览器尺寸及 WebKit 引擎验证。未宣称真实 Android/iPhone/iPad 硬件验收。

## EPUB 触控补充验收

补充检查发现 Safari 触控会让选区失焦，鼠标专用的 preventDefault 也会吞掉“引用选文”点击。已在顶部按钮 pointerdown 时捕获原文，区分触摸与鼠标事件，补充 EPUB 触摸结束处理，并将草稿中的插入位置同步到重新打开的正文编辑器。Chromium Android 尺寸、WebKit iPhone、WebKit iPad 的 PDF 与 EPUB 全流程均通过，包含原文全文、章节、CFI、横竖屏与保存后的重开。发布草稿中的旧试验包将由重新构建的最终包替换，再做安装核验。

## 手机回原文与代码冻结

手机全屏笔记板的“回到原文”先完成保存，再收起遮挡书页的侧栏；平板并排及桌面继续保留笔记板。修正导航沿用旧 paperMode 状态导致侧栏重新打开的问题。最终 Chromium Android 尺寸、WebKit iPhone/iPad 的 15 项 PDF/EPUB 流程全部通过。此后只进行构建、签名、安装核验与发布，不继续增加功能。

使用者选择先发布并保留当前 Mac 阅读窗口，本次不退出或替换本机应用；新版 Mac 安装包仍统一提供。

## 正式发布回执（2026-10-29）

- 冻结代码、源码 ZIP 与发布标签：688a23370fa668a8f1d3d1a3c2ab6cac53dc486a。此后的提交仅补充回执和公开更新索引，不改变安装包或标签。
- [GitHub 正式发布](https://github.com/largetomatoes/wenjian-software/releases/tag/v3.141-build343) 共 9 个文件，所有远端摘要与本机一致。
- [官网](https://largetomatoes.github.io/wenjian-web/) 已更新下载、演示及更新索引；部署任务 [40825918835](https://github.com/largetomatoes/wenjian-web/actions/runs/40825918835) 通过，线上页面与本地一致。
- [原 Web App](https://reader.wenjian-app.workers.dev/read/) 已更新，线上 JS、Service Worker、manifest 与 343 构建逐字一致。Cloudflare 版本 1863c941-3192-4eb9-a3a1-4fb58a963b71，保持原网址和资料位置。
- 按使用者要求，本次没有退出、替换或改动本机应用及当前阅读窗口。

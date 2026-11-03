# 问间 3.14159（348）构建说明

对应源码以本次 Release 标签 v3.14159 为准。源码使用项目 LICENSE；依赖保留其原许可证。签名私钥与个人资料不包含在源码及安装包中。

基础环境：Node.js 22.13+，npm ci。各端共用 lib/ 与 components/ 的阅读及笔记逻辑。

- Mac：在 macOS 上运行 node work/mac-app/scripts/build-mac.mjs，使用干净 Electron 运行时生成 ZIP。安装到 Applications 后运行；本项目未做 Apple 开发者公证。
- Windows：运行 node work/mac-app/scripts/build-windows.mjs，需要 Windows Electron 二进制及 NSIS makensis；生成标准更新 ZIP 和可选择安装目录的 Setup.exe。保留默认 GPU 策略和托盘设置。
- Android：npm run build:mobile；npx cap sync android；使用 JDK 21、Android SDK 36，在 android/ 中运行 ./gradlew assembleRelease testReleaseUnitTest。分发时必须用自己的证书签名；官方签名密钥不会公开。
- iPhone/iPad Web App：npm run build:web-app。以原域部署 webapp/host-dist，提供同源 WebDAV 中转与静态 PWA；不得把浏览器 IndexedDB 或用户密码打入构建。自行部署需要自己的托管账号。

回归：node --test tests/test-writing-library.cjs tests/test-release348-compat.cjs tests/test-save-client-reliability.cjs tests/test-save-reliability.cjs。历史检测器测试需要对应 Git 历史对象。隔离原生 UI 检查见 tests/test-writing-library-ui.cjs、test-writing-workspace-ui.cjs 和 test-writing-workspace-edge-ui.cjs，显式设置候选应用与报告目录，仅用虚构资料。

正式更新清单单独使用原发行私钥签名，签名过程验证与应用内公钥一致，安装前继续进行 SHA256、资料保护与失败回滚。自行构建不能冒用官方更新签名。

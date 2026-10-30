# 问间 3.141（344）统一发布
基准：Mac 本地已验收的 a560a6f，包含阅读写作优先、书目/标题/主题查找、本书全部笔记切换、每篇独立光标和滚动位置、保存失败阻止切换及保存中继续输入保护。

| 阶段 | 工作 | 验收 |
| --- | --- | --- |
| 版本 | Mac / Windows / Android / Web 统一构建 344 | 343 可识别新构建，标准安装包命名、RSA 更新签名、Android 原证书 |
| Windows | 使用共享阅读代码，保留字体、OCR 调度、GPU 默认、托盘及安装路径选择 | 构建、UTF-8/资源检查、Windows CI 安装/覆盖/回滚/旧版升级 |
| Android | 接入相同写作、切换与主题查询；过程笔记章节浏览作为辅助 | 手机布局、触控选文、原生 release 编译，原证书签名 |
| iPhone/iPad | 保持原 Web App 域名和数据库身份，复用手机与平板布局 | WebKit 横竖屏、双篇切换、主题查找、旧 Web App 更新及离线数据保留 |
| 使用说明 | 更新本书笔记入口、主题及章节辅助查询说明，提供真实虚构资料演示图 | 无私人资料或云端凭据 |
| 发布 | 冻结源码、完整源码 ZIP、四端安装/入口、校验清单及简短发布说明 | 全部附件具备后正式发布，官网和公开更新索引最后切换 |

测试只使用隔离虚构书籍和笔记。未进行实体 Windows/Android/iOS 硬件性能验收时明确记录；不将浏览器模拟当作真机测试。不退出本机正在使用的问间；此次公开 Mac 包与功能基准保持一致。

## 冻结前检查
- TypeScript 通过。
- Android 尺寸 Chromium、iPhone WebKit、iPad WebKit：每端 17 项阅读/笔记/主题查找检查通过；均使用独立虚构资料。
- 移动存储、插件、更新签名、图形偏好及完整备份：本机适用的 41 项检查通过。两项明确要求 Windows 的安装测试留给 Windows 机器，不以 Mac 运行结果当作功能失败或验收。
- Mac 私有基准的两篇原笔记均完整保留；未以私人内容作为发布测试数据。
- 最终构建、CI 安装检查和发布校验将在附件 validation-344.json 中记录。

## 正式发布回执（2026-10-30）

- [问间 3.141（344）](https://github.com/largetomatoes/wenjian-software/releases/tag/v3.141-build344) 已正式发布，9 个附件的远端 SHA256 与本机一致；包括 Mac、Windows 安装版与便携版、Android、完整源码、更新签名与验证记录。
- 发布源码与标签：959f594b8571d3dbef4d47531bea69e48c509474。应用安装包构建自 ab86c1c；两者仅相差 Windows 测试隔离和卸载清理等待，应用输入代码完全相同。附件 validation-344.json 保留此对应关系。
- [Android 原生构建与单元检查](https://github.com/largetomatoes/wenjian-software/actions/runs/40987619488) 通过；本机使用原证书签名，v1/v2/v3 和证书指纹核验通过。
- [Windows 最终检查](https://github.com/largetomatoes/wenjian-software/actions/runs/40989960160) 两组全部通过：实际安装/字体/覆盖/卸载/中断恢复，以及新机器上的 339 → 344 升级，笔记与草稿字节保持不变。测试改为等待 NSIS 子进程实际完成清理；不以启动器返回或固定等待 5 秒作为完成依据。
- Mac 最终包 8 项笔记切换检查、三种手机/平板浏览器各 17 项阅读与主题查找检查通过；实际 Web App 343 → 344 升级后保存内容、未提交草稿与离线重开通过。未将浏览器模拟当作 Android/iOS 真机验收。
- [官网](https://largetomatoes.github.io/wenjian-web/) 已更新，Pages 任务 [40990858300](https://github.com/largetomatoes/wenjian-web/actions/runs/40990858300) 通过；线上 HTML、图片与 344 更新清单均核对一致。
- [原 Web App](https://reader.wenjian-app.workers.dev/read/) 已在线运行 344，最终 Service Worker 核对一致。Cloudflare 版本 918cfb0a-bcca-4c65-aa72-ebaad93115ee，原网址与浏览器资料位置继续沿用。
- 正式发布后的元数据检查确认 Mac / Windows / Android 的 343 客户端均可发现标准名称的 344 更新包，344 自身显示当前版本；没有 Manual 后缀。
- 本次没有退出或替换使用者正在使用的本机问间。测试仅使用独立虚构资料。

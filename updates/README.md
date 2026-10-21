# 公开更新清单

`releases.json` 只包含已发布版本的公开元数据，不含用户笔记、密钥或访问令牌。

Mac 337 起，依次读取官网清单、现有 Web App 域名上的备用清单、GitHub Releases API。官网每次推送及每小时通过自带的 GitHub Actions 临时凭据刷新；发布后手动运行官网 workflow 可立即生效。备用站点转读官网，连接失败时使用构建时的公开清单。更新包仍须通过原 RSA 签名、构建号、平台、文件哈希及来源校验。

发布步骤：先发布新的不可变 GitHub Release，再运行 wenjian-web 的 Pages workflow，确认两条清单含新版本。部署 Web App 前同步此文件以更新离线备用快照。旧客户端仍读取 GitHub API，保留旧 Release / 安装包；受限流影响时需下载正式包覆盖安装一次。不要在客户端加入 GitHub token。

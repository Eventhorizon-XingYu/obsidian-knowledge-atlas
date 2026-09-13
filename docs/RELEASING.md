# 发布到 GitHub

源码仓库：[Eventhorizon-XingYu/obsidian-knowledge-atlas](https://github.com/Eventhorizon-XingYu/obsidian-knowledge-atlas)。插件名称为 Xingyu Note Atlas，ID 为 `xingyu-note-atlas`，发布后不要更改 ID。

1. 将本项目源码推送至上述仓库。不要推送原来的网页项目中的 `data.js`、私人 vault、`.qa` 测试配置或凭据。
2. 检查 `manifest.json` 中的作者署名，按需要增加 `authorUrl`；保持插件 ID 为 `xingyu-note-atlas`。如更改 ID，也需同步打包和发布路径。
3. 运行 `npm ci --ignore-scripts` 和 `npm run package`，检查发行目录与 `SHA256SUMS.txt`。
4. 确保 `package.json` 和 `manifest.json` 版本相同，并在 `versions.json` 中记录该版本需要的最低 Obsidian 版本。
5. 提交源码后推送不带 `v` 前缀的版本标签，例如 `1.0.0`。GitHub Actions 会复核版本、测试、编译，生成 Release 和 zip。
6. 在 Release 中验证直接下载附件包含 `main.js`、`manifest.json`、`styles.css`。Obsidian 社区分发依赖这些文件，不能只上传源码压缩包。

本机也可直接复制 `dist/xingyu-note-atlas` 到 vault 的插件目录进行安装。CI 未真正运行前，不能把本地构建通过当作 GitHub CI 已通过。

## 社区市场

GitHub 开源和 Obsidian 社区市场上架是两个步骤。按 2026-09-13 核实的 [官方插件提交指南](https://docs.obsidian.md/plugins/releasing/submit-plugin)，当前流程是在社区网站提交，而不是向旧插件列表提 PR：

1. 登录 [Obsidian Community](https://community.obsidian.md)，在个人资料中关联仓库拥有者的 GitHub 账号。
2. 打开 Plugins → New plugin，填写本仓库 URL，并选择维护者。
3. 由维护者阅读并确认开发者政策和后续维护承诺，再提交审核。
4. 网站读取默认分支 HEAD 的 `manifest.json`；对应版本的 GitHub Release 必须附有三个运行文件。
5. 根据自动审核反馈修复问题，递增版本并发布新的 Release；全部错误解决且完成发布后，才能宣称可从 Obsidian 内安装。

具体账号关联与提交步骤见 [Set up and claim](https://docs.obsidian.md/community-directory/set-up-and-claim)。登录、提交、审核、正式收录应分别验证，不可混为一谈。

官方参考：[插件 API](https://github.com/obsidianmd/obsidian-api)、[示例插件](https://github.com/obsidianmd/obsidian-sample-plugin)。

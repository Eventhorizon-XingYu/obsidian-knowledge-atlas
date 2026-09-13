# 发布到 GitHub

此仓库已准备好开源所需的许可证、依赖许可、文档、版本清单、CI 和发布工作流。首次发布前请自行设置仓库名称和拥有者；源码不硬编码个人 GitHub 账号。

1. 在自己的 GitHub 账号下创建一个空仓库（例如 `obsidian-knowledge-atlas`），将本项目作为源码仓库推送。不要推送原来的网页项目中的 `data.js` 或私人 vault。
2. 检查 `manifest.json` 中的作者署名，按需要增加 `authorUrl`；保持插件 ID 为 `knowledge-atlas`。如更改 ID，也需同步打包和发布路径。
3. 运行 `npm ci --ignore-scripts` 和 `npm run package`，检查发行目录与 `SHA256SUMS.txt`。
4. 确保 `package.json` 和 `manifest.json` 版本相同，并在 `versions.json` 中记录该版本需要的最低 Obsidian 版本。
5. 提交源码后推送不带 `v` 前缀的版本标签，例如 `1.0.0`。GitHub Actions 会复核版本、测试、编译，生成 Release 和 zip。
6. 在 Release 中验证直接下载附件包含 `main.js`、`manifest.json`、`styles.css`。Obsidian 社区分发依赖这些文件，不能只上传源码压缩包。

本机也可直接复制 `dist/knowledge-atlas` 到 vault 的插件目录进行安装。CI 未真正运行前，不能把本地构建通过当作 GitHub CI 已通过。

## 社区市场

GitHub 开源和 Obsidian 社区市场上架是两个步骤。稳定版本发布后，可以按 [官方插件提交指南](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin) 向 `obsidianmd/obsidian-releases` 提交插件信息，等待审核。审核结果、重名检查和市场收录不由此仓库保证。

官方参考：[插件 API](https://github.com/obsidianmd/obsidian-api)、[示例插件](https://github.com/obsidianmd/obsidian-sample-plugin)。

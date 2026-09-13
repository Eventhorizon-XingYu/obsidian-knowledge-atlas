# 测试

## 自动检查

`npm run check` 执行 Node 单元测试、TypeScript 严格检查和浏览器平台 CommonJS 打包。测试包括解析后的双向邻域、中文别名搜索、多条件筛选、同名不同路径、节点上限、数据不变性、路径穿越与非法文件名。

## 原生宿主集成

`node scripts/prepare-native-test.mjs` 生成 `.qa/Atlas-test-vault/`、独立的 `.qa/profile/` 配置和测试运行器。它只包含人造示例文档，运行器硬性检查 vault 名。**不要将测试运行器安装到日常库。** 脚本不会覆盖已经存在的示例笔记，建议每次回归用一个新复制的项目目录或手动归档上一轮 `.qa` 后再生成。

使用已安装的 Obsidian 打开这份隔离配置（Electron 的 `--user-data-dir=<本项目绝对路径>/.qa/profile`）。如果宿主弹出测试库信任确认，请在检查路径后手动处理。完成后查看 `.qa/Atlas-test-vault/native-test-results.json`，必须 `finished: true` 且 `failed: 0`。

运行器在真实宿主内检查：命令注册、canvas 渲染、元数据关系、搜索与筛选、原生预览、打开文件、局部邻域、新建、冲突与路径穿越拒绝、链接追加与去重、改名/移动、修改后预览更新、取消删除、确认回收站、设置变化、关闭资源释放和重开。它使用生产源代码的弹窗和操作接口；最终 UI 仍需人工/界面自动化检查。

## 视觉检查

在真实 Obsidian 中确认节点分散、连线可见、标题与按钮可读，拖拽/缩放正常。缩小面板检查侧栏覆盖布局；切换浅色主题并选择「跟随 Obsidian」。无障碍用户应能从笔记列表使用键盘选择文档。首次发布前建议另行在手机上验证；`isDesktopOnly: false` 说明未依赖 Node/Electron API，并不替代真机测试。

运行器和示例库不会进入发行包。GitHub CI 运行单元测试与构建，不会在 CI 中启动 Obsidian。

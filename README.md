# 模拟器验证台 · Simulator Watch

一个 DSH 插件：**扫描工作区分组与会话，观测会话里发起的 iOS 模拟器验证，统一显示状态。**
面板只做观测，不启动模拟器、不跑构建、不占用会话。

- 侧栏入口：左侧栏的「模拟器验证台」图标（面板 id `ios-sim`）。
- 不提供「开始验证」「绑定设备」「停止」等操作；验证由会话自己（agent 的 bash / terminal 工具）发起。

## 它显示什么

对每个工作区、每个会话：

- 当前是否在验证（运行中 / 通过 / 失败 / 未验证）；
- 验证类型（UI 测试 / 构建 / simctl 操作）；
- 识别出的模拟器（机型、运行时、UDID，来自命令的 `-destination` 或命令行里的 UDID）；
- 已运行时长；完成后显示通过/失败、通过/失败用例数、失败用例名、最后一条 `error:`；
- 会话实际执行的命令（截断显示），可展开查看输出末尾。

## 会话指定机型与冲突约束

每个会话可以在面板里指定一台模拟器（机型 + UDID），用来把会话的推送/测试固定到一台设备：

- 指定后，Host 注册一个工具 guard：会话里的 `bash` / `terminal` 如果执行
  `xcodebuild … -destination id=<其他设备>`、`simctl … <其他 UDID>`，会被**拒绝执行**并返回原因；
- 某台设备已指定给其他会话时，任何会话试图使用它都会被拒绝，避免两个会话同时占一台机器；
- 正在被另一个会话的验证占用时也会拒绝；
- 被拒绝的尝试仍会出现在面板里，状态为「已拦截」，并标出「机型不符」/「设备冲突」，方便回看；
- 面板里每行都有「指定机型」下拉，已被其他会话占用的设备显示为不可选。

如果会话指定了机型、但命令里没有写 `-destination`（例如 `make test`），面板会按指定机型展示并标记「按指定机型」；guard 不会拦截这类命令。

## 状态从哪里来

Host 监听 DSH 的 `session/event`：

1. `tool/call`：如果工具是 `bash` / `terminal`，且命令包含
   - `xcodebuild … test` / `xcodebuild … build`
   - `make test` / `make verify`
   - `simctl launch|install|spawn|io|boot`
   就登记一条运行中的观测记录。
2. `tool/result`：同一个 `callId` 返回时，解析输出里的
   `** TEST SUCCEEDED/FAILED **`、`** BUILD SUCCEEDED/FAILED **`、
   `Test Case '…' passed/failed`、`[exit code: N]`、`error:`，得到最终状态与统计。

插件启动时还会扫描当前 live 会话最近的事件，尽量恢复正在运行的验证。
**不会启动任何进程**。

## 面板交互

- 工作区分组、会话状态、命令与输出；「只看正在验证」筛选。
- 排序：最近活动 / 创建时间 / 名称 / 机型 / 状态 / 默认顺序。
- 默认顺序：拖动会话调整组内顺序，拖动目录调整分组顺序；顺序持久化。
- 悬停排序控件显示当前排序规则；悬停手柄显示拖动范围。
- 完成时可选系统通知（面板底部「通知」）。

## 数据

- 面板偏好：`$DSH_PROFILE_DIR/data/ios-simulator/state.json`（`ui` 字段）。
- 观测记录只保存在 Host 内存中：重载插件会清空已完成记录；正在运行且能恢复的验证会重新出现。
- 不再产生 `runs/` 日志或截图；输出末尾取自会话的 `tool/result` 内容。

## 已知限制

- 只识别工具参数里**字面出现**的 `xcodebuild` / `simctl` / `make test`；把命令藏进脚本或变量里无法识别。
- 以 `run_in_background` 方式启动的 bash 命令，在工具返回时观测就结束（后台进程继续跑，但插件拿不到后续输出）。
- 拿不到插件启动之外的截图；要截图请在会话里自行 `simctl io … screenshot`。
- 观测依赖 `session/event` 的实时投递；插件重载后已完成的记录不补扫。

## 安装

已作为本地 bundle 安装在 `desktop` profile，源码链接到本目录：

```
~/.dsh/profiles/desktop/node_modules/@local/dsh-ios-simulator -> <this directory>
```

修改 Host 代码后，在插件管理中关闭再启用该 bundle 即可重新导入；`client.js` 由前端 HMR 生效。

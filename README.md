# 模拟器验证台 · iOS Simulator Lab

一个 DSH 插件：**每个会话独占一台 iOS 模拟器**，在后台跑构建 / 安装 / UI 测试，实时查看状态，完成后通过系统通知和应用内提醒叫你回模拟器验收。

- 侧栏入口：左侧栏的 `模拟器验证台` 图标（面板 id `ios-sim`，顺序 20，位于「任务调度」之后）。
- 智能体工具：`ios_simulator`（`list` / `assign` / `run` / `status` / `stop` / `open` / `screenshot`）。

## 为什么不会互相阻断

- 会话与设备一一绑定；同一会话同时只允许一个验证任务，同一设备也同时只服务一个会话。
- `run` 立即返回 job id，构建与测试在 Host 进程里异步执行，不占住对话。
- 默认自动挑选**空闲且已关闭的 iPhone**（最新运行时优先），不会动你正在看的模拟器。
- 两个会话并行验证时会落在两台不同的设备上；设备被占用时面板会禁用该选项并给出原因。

## 工作区分组

面板按会话的**工作区目录**分组：组头显示目录名、`~/...` 路径、会话数和正在验证的数量，可折叠。同一目录下的多个会话（例如 `~/Downloads` 里的 5 个会话）收在同一个组里，组与组之间按“有任务 > 有绑定 > 最近活动”排序。筛选“只看已绑定设备”后，空组会自动隐藏。

## 面板状态会记住

切换面板、刷新页面、甚至 Web 端口变化后重启，下面这些选择都不会被重置：

- 「只看已绑定设备」筛选和「显示全部会话」
- 工作区分组的折叠状态
- 哪些任务的日志是展开的
- 哪些任务的截图被手动收起（有截图的任务默认展开）

保存分两层：Host 的 `data/ios-simulator/state.json`（带 `updatedAt`，跨端口/重启存活）和浏览器 localStorage（同页面内立即恢复）。面板挂载时取较新的一份，旧缓存不会覆盖新选择；任务本身的运行状态始终以 Host 为准。

## 机型锁定（不会偷偷换机）

一旦你给会话选了具体设备，它就锁定到**该设备 + 该机型**：

- `run` 前先做 `simctl` 预检：UDID、机型标识（`deviceTypeIdentifier`）、运行时逐一比对，日志第一行会打印
  `· 机型锁定：iPhone 15 Pro（iPhone 15 Pro）· iOS 17.0 · <UDID>`。
  身份以 `deviceTypeIdentifier` + UDID 为准，所以给模拟器改名不会误判，换机型一定会被拦下。
- 绑定的设备被删除或机型对不上时**直接报错中止**，不会自动改绑到别的机型。
- `xcodebuild` 使用 `-destination platform=iOS Simulator,id=<UDID>`，并强制
  `-parallel-testing-enabled NO`，避免克隆机/并发目标把测试分到别的机子上。
- 如果日志里出现 `Using the first of multiple matching destinations`，任务直接判失败。
- 启动后再复查一次该 UDID 是否处于 `Booted`，安装、启动、截图都只用这个 UDID。

## 面板能做什么

- 按会话列出当前绑定设备、运行状态、步骤（启动/构建/测试/安装/启动 App/截图）与耗时。
- 每行可切换设备（或「自动分配」）、选择验证方式、覆盖 Scheme、启动/停止、打开模拟器。
- 展开可看日志末尾、完整日志链接、验证完成时的模拟器截图。
- 底部设置：完成通知、完成后自动打开模拟器、未绑定时自动分配。

验证方式：

| 模式 | 行为 |
| --- | --- |
| `install`（默认） | `xcodebuild build` → 启动模拟器 → 安装 → 启动 App → 等待 1.6s 截图 |
| `test` | `xcodebuild test`（UI 测试），结束后截图 |
| `build` | 只构建，不启动模拟器、不截图 |
| `command` | 在会话目录执行自定义命令，导出 `$DSH_SIM_UDID` / `$DSH_SIM_NAME`，结束后截图 |

结果会从 xcodebuild 输出里解析通过/失败用例数、失败用例名和最后一条 `error:`；即使退出码是 0，只要出现失败用例也会判为失败，提醒不会“报喜不报忧”。

工程与 Scheme 默认从会话目录自动识别（`*.xcworkspace` > `*.xcodeproj`，再跑 `xcodebuild -list -json`）；也可在面板或工具里显式指定 `project` / `workspace` / `scheme`。

## 完成提醒

任务结束时：

1. **macOS 系统通知**：
   - 标题：`✅ 模拟器验证通过` / `❌ 模拟器验证失败` / `⏹ 模拟器验证已停止`
   - 副标题：`工作区 · 机型 · 运行时 · Scheme`
   - 正文：`会话「…」· 验证方式 · 用时 2:31`，第二行是结果，如
     `TEST FAILED · 2 个测试失败（…）· <最后一条 error>`
   - 成功用 Glass、失败用 Basso、停止用 Pop 提示音。
2. **应用内提示**：显示工作区、会话、机型/运行时、Scheme、用时、通过/失败数、失败用例、错误摘要，
   并附上本次运行的模拟器截图缩略图；按钮为「查看」「打开模拟器」「知道了」。
3. 侧栏图标出现红点，直到你打开面板。

通知默认开启，可在面板底部关闭；关闭后系统通知不发，但应用内提示和历史记录仍然保留。手动停止也会发一条“已停止”通知。

## 数据位置

```
$DSH_PROFILE_DIR/data/ios-simulator/
├── state.json          # 会话绑定与偏好（重启后保留）
├── history.json        # 最近 60 次任务摘要
├── runs/job-*.log      # 每次任务的完整日志
├── shots/job-*.png     # 完成时的模拟器截图
└── derived/<udid>/     # 按设备隔离的 DerivedData（增量构建）
```

没有设置 `DSH_PROFILE_DIR` 时回退到 `~/.dsh/data/ios-simulator/`。

## HTTP 接口（面板使用）

Host 在 `ctx.webServer` 上注册 `/dsh-ios-sim` 前缀路由：

- `GET /dsh-ios-sim/state` — 设备、会话、绑定、任务快照。
- `POST /dsh-ios-sim/action` — `assign` / `run` / `stop` / `open` / `screenshot` / `settings` / `refresh`。
- `GET /dsh-ios-sim/shot/<file>.png` — 截图。
- `GET /dsh-ios-sim/log/<jobId>` — 纯文本日志。

POST 会校验 `Origin` 必须等于本机 Web 服务地址；路由本身不携带业务鉴权，因此只在回环监听（默认）下使用。

## 安装与更新

已作为本地 bundle 安装在 `desktop` profile：

```
~/.dsh/profiles/desktop/package.json  →  bundles: @local/dsh-ios-simulator
```

修改 Host 代码（`index.js`）后，在插件管理中关闭再启用该 bundle 即可重新导入，无需重启 Harness；修改 `client.js` 由前端 HMR 自动生效。

> 注意：重新加载会终止正在运行的验证任务，任务会记为失败/中断。

## 已知限制

- 仅 macOS + Xcode 环境；非 Web profile（无 `webServer`）不会激活。
- 只识别本机 `xcrun simctl` 可见的模拟器，不管理真机。
- 截图在 App 启动后 1.6 秒拍摄；如果首屏更慢，图里可能是启动页，可稍后用「截图」再拍一次。
- 失败用例名来自 xcodebuild 文本输出（兼容新旧两种 `Test Case` 格式，旧格式会转成 `Class.testName`），只在解析到时展示。
- 通知正文第一行是结果摘要，第二行是会话/验证方式/用时；即使正文被折叠，标题与副标题仍能看出机型和工作区。
- 系统通知依赖 macOS 对宿主 App 的通知授权；授权缺失时仍有应用内提示。
- 没有做设备「归还」的自动回收：会话长期不用时绑定会保留，可在面板中切回「自动分配」。

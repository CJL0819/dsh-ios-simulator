/**
 * iOS Simulator Lab — Client half.
 *
 * Registers the sidebar entry (`sidebar.panellist` + `main` panel) and the
 * completion toast. Talks to its Host half over the package-private HTTP routes
 * under `/dsh-ios-sim`; the page polls a small JSON snapshot so every session's
 * status stays live without a Remote codegen step.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-ios-simulator',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'ios-simulator'
    const PANEL_ID = 'ios-sim'
    const API = '/dsh-ios-sim'

    const zh = {
      'page.title': '模拟器验证台',
      'page.subtitle': '扫描工作区与会话，自动识别会话里发起的模拟器验证，统一查看状态。',
      'page.foot': '状态来自会话的 tool/call 与 tool/result 事件；验证台只观测，不启动模拟器、不占用会话。',
      'page.devices': '可用设备',
      'page.free': '空闲',
      'page.sessions': '个会话',
      'page.bound': '个已绑定',
      'page.verifying': '个正在验证',
      'page.workspaces': '个工作区',
      'group.running': '个进行中',
      'lock.locked': '机型已锁定',
      'lock.auto': '自动分配',
      'job.passedCount': '通过',
      'job.failedCount': '失败',
      'job.failedTests': '失败用例',
      'toast.workspace': '工作区',
      'toast.session': '会话',
      'toast.duration': '用时',
      'field.device': '测试机',
      'assign.label': '指定机型',
      'assign.none': '未指定',
      'warn.mismatch': '机型不符',
      'warn.conflict': '设备冲突',
      'warn.assumed': '按指定机型',
      'field.mode': '验证方式',
      'field.scheme': 'Scheme',
      'field.command': '命令',
      'device.auto': '自动分配空闲设备',
      'device.booted': '已启动',
      'device.shutdown': '已关闭',
      'device.other': '会话占用',
      'mode.build': '仅构建',
      'mode.install': '安装并启动',
      'mode.test': '运行 UI 测试',
      'mode.command': '自定义命令',
      'action.run': '开始验证',
      'action.running': '正在验证…',
      'action.open': '打开模拟器',
      'action.stop': '停止',
      'action.refresh': '刷新',
      'action.log': '日志',
      'action.shot': '截图',
      'action.more': '显示全部会话',
      'action.less': '收起',
      'action.retry': '重试',
      'action.dismiss': '关闭',
      'filter.assigned': '只看正在验证',
      'sort.label': '排序',
      'sort.activity': '最近活动',
      'sort.created': '创建时间',
      'sort.title': '会话名称',
      'sort.device': '绑定机型',
      'sort.status': '运行状态',
      'sort.manual': '默认顺序',
      'sort.drag': '拖动排序',
      'sort.dragGroup': '拖动调整目录顺序',
      'sort.help.manual': '默认顺序：按你手动排列的会话与目录顺序显示',
      'sort.help.activity': '最近活动：运行中优先，其次是已绑定、有历史，再按最近任务时间',
      'sort.help.created': '创建时间：新会话在前',
      'sort.help.title': '会话名称：按标题升序',
      'sort.help.device': '绑定机型：按机型名升序，未绑定排最后',
      'sort.help.status': '运行状态：运行中 > 排队 > 失败 > 通过 > 停止 > 空闲',
      'sort.help.sessionDrag': '拖动调整会话顺序（仅当前工作区）',
      'sort.help.groupDrag': '拖动调整目录顺序',
      'status.idle': '空闲',
      'status.unverified': '未验证',
      'status.blocked': '已拦截',
      'status.queued': '排队中',
      'status.running': '运行中',
      'status.passed': '通过',
      'status.failed': '失败',
      'status.stopped': '已停止',
      'status.interrupted': '已中断',
      'step.queue': '准备',
      'step.boot': '启动模拟器',
      'step.build': '构建',
      'step.test': '测试',
      'step.install': '安装',
      'step.launch': '启动 App',
      'step.screenshot': '截图',
      'step.command': '执行命令',
      'step.simctl': '模拟器操作',
      'step.done': '完成',
      'job.elapsed': '用时',
      'job.exit': '退出码',
      'job.noLog': '暂无日志',
      'job.fullLog': '打开完整日志',
      'job.shotAlt': '模拟器截图',
      'settings.title': '通知',
      'settings.notify': '完成时发送系统通知',
      'settings.autoOpen': '完成后自动打开模拟器',
      'settings.autoAssign': '未绑定设备时自动分配',
      'toast.passed': '验证通过，去模拟器看看',
      'toast.failed': '验证失败',
      'toast.stopped': '验证已停止',
      'toast.blocked': '被机型约束拦截',
      'toast.view': '查看',
      'toast.open': '打开模拟器',
      'toast.dismiss': '知道了',
      'empty.title': '还没有可分配的会话',
      'empty.body': '在左侧新建一个会话后，这里会列出它并自动绑定一台空闲模拟器。',
      'empty.observed': '等待会话发起验证',
      'device.unknown': '模拟器（未识别）',
      'empty.run': '这个会话还没有发起过模拟器验证；在会话里运行 xcodebuild / simctl 后会自动出现状态。',
      'empty.filtered': '当前没有正在验证的会话。',
      'error.load': '无法读取验证台状态',
      'error.action': '操作失败',
      'time.justNow': '刚刚',
      'time.minutes': '分钟前',
      'time.hours': '小时前',
    }

    const en = {
      'page.title': 'Simulator Lab',
      'page.subtitle': 'Scans workspaces and sessions, detects simulator verification started from a session, and shows one live status.',
      'page.foot': 'State is derived from the session tool/call and tool/result events; this panel observes only and never starts a simulator.',
      'page.devices': 'devices',
      'page.free': 'free',
      'page.sessions': 'sessions',
      'page.bound': 'bound',
      'page.verifying': 'verifying',
      'page.workspaces': 'workspaces',
      'group.running': 'running',
      'lock.locked': 'model locked',
      'lock.auto': 'auto-assigned',
      'job.passedCount': 'passed',
      'job.failedCount': 'failed',
      'job.failedTests': 'Failed tests',
      'toast.workspace': 'Workspace',
      'toast.session': 'Session',
      'toast.duration': 'Duration',
      'field.device': 'Device',
      'assign.label': 'Assigned device',
      'assign.none': 'Not assigned',
      'warn.mismatch': 'Device mismatch',
      'warn.conflict': 'Device conflict',
      'warn.assumed': 'Assigned device assumed',
      'field.mode': 'Mode',
      'field.scheme': 'Scheme',
      'field.command': 'Command',
      'device.auto': 'Auto-assign a free device',
      'device.booted': 'booted',
      'device.shutdown': 'shut down',
      'device.other': 'in use',
      'mode.build': 'Build only',
      'mode.install': 'Install & launch',
      'mode.test': 'Run UI tests',
      'mode.command': 'Custom command',
      'action.run': 'Start verification',
      'action.running': 'Verifying…',
      'action.open': 'Open simulator',
      'action.stop': 'Stop',
      'action.refresh': 'Refresh',
      'action.log': 'Log',
      'action.shot': 'Screenshot',
      'action.more': 'Show all sessions',
      'action.less': 'Collapse',
      'action.retry': 'Retry',
      'action.dismiss': 'Dismiss',
      'filter.assigned': 'Only running',
      'sort.label': 'Sort',
      'sort.activity': 'Recent activity',
      'sort.created': 'Created',
      'sort.title': 'Session name',
      'sort.device': 'Device',
      'sort.status': 'Status',
      'sort.manual': 'Default order',
      'sort.drag': 'Drag to reorder',
      'sort.dragGroup': 'Drag to reorder workspace',
      'sort.help.manual': 'Default order: your manually arranged session and workspace order',
      'sort.help.activity': 'Recent activity: running first, then bound, then history, by latest run',
      'sort.help.created': 'Created: newest session first',
      'sort.help.title': 'Session name: ascending by title',
      'sort.help.device': 'Device: ascending by model, unbound last',
      'sort.help.status': 'Status: running > queued > failed > passed > stopped > idle',
      'sort.help.sessionDrag': 'Drag to reorder sessions (same workspace only)',
      'sort.help.groupDrag': 'Drag to reorder workspaces',
      'status.idle': 'Idle',
      'status.unverified': 'Not verified',
      'status.blocked': 'Blocked',
      'status.queued': 'Queued',
      'status.running': 'Running',
      'status.passed': 'Passed',
      'status.failed': 'Failed',
      'status.stopped': 'Stopped',
      'status.interrupted': 'Interrupted',
      'step.queue': 'Preparing',
      'step.boot': 'Booting simulator',
      'step.build': 'Building',
      'step.test': 'Testing',
      'step.install': 'Installing',
      'step.launch': 'Launching app',
      'step.screenshot': 'Screenshot',
      'step.command': 'Running command',
      'step.simctl': 'Simulator',
      'step.done': 'Done',
      'job.elapsed': 'took',
      'job.exit': 'exit',
      'job.noLog': 'No log yet',
      'job.fullLog': 'Open full log',
      'job.shotAlt': 'Simulator screenshot',
      'settings.title': 'Notifications',
      'settings.notify': 'Send a system notification when a run finishes',
      'settings.autoOpen': 'Open the simulator automatically when done',
      'settings.autoAssign': 'Auto-assign a device when none is bound',
      'toast.passed': 'Verification passed — take a look',
      'toast.failed': 'Verification failed',
      'toast.stopped': 'Verification stopped',
      'toast.blocked': 'Blocked by device constraint',
      'toast.view': 'View',
      'toast.open': 'Open simulator',
      'toast.dismiss': 'Dismiss',
      'empty.title': 'No sessions to assign yet',
      'empty.body': 'Create a session on the left; it will appear here and can claim a free simulator.',
      'empty.observed': 'Waiting for a session run',
      'device.unknown': 'Simulator (unknown)',
      'empty.run': 'No simulator verification from this session yet; run xcodebuild / simctl in the session and the status appears here.',
      'empty.filtered': 'No verification is running.',
      'error.load': 'Cannot read Simulator Lab state',
      'error.action': 'Action failed',
      'time.justNow': 'just now',
      'time.minutes': 'min ago',
      'time.hours': 'h ago',
    }

    const CSS = `
.iosims-page{height:100%;min-height:0;overflow:auto;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.5}
.iosims-page *{box-sizing:border-box}
.iosims-inner{max-width:1000px;margin:0 auto;padding:28px 28px 72px;display:flex;flex-direction:column;gap:18px}
.iosims-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.iosims-title{margin:0;font-size:20px;font-weight:650;letter-spacing:-.01em}
.iosims-sub{margin:6px 0 0;font-size:12.5px;color:var(--dsw-alias-label-secondary);max-width:620px}
.iosims-stats{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--dsw-alias-label-secondary);flex-wrap:wrap;justify-content:flex-end}
.iosims-stat b{color:var(--dsw-alias-label-primary);font-weight:600}
.iosims-sort{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.iosims-sort-select{height:28px;min-width:118px;max-width:160px;font-size:12px}
.iosims-btn{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 12px;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .12s ease,border-color .12s ease,opacity .12s ease}
.iosims-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}
.iosims-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.iosims-btn:disabled{opacity:.45;cursor:not-allowed}
.iosims-btn.primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff}
.iosims-btn.primary:hover:not(:disabled){filter:brightness(1.06);background:var(--dsw-alias-brand-primary)}
.iosims-btn.danger{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);background:transparent}
.iosims-btn.ghost{border-color:transparent;background:transparent;color:var(--dsw-alias-label-secondary)}
.iosims-btn.small{padding:4px 9px;font-size:11.5px;border-radius:7px}
.iosims-filter{display:flex;align-items:center;gap:11px;padding:12px 2px 14px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.iosims-filter-icon{width:30px;height:30px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);flex:none}
.iosims-filter-text{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.iosims-filter-title{font-size:13px;font-weight:650;color:var(--dsw-alias-label-primary)}
.iosims-filter-sub{font-size:11.5px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.iosims-switch{position:relative;display:inline-flex;align-items:center;cursor:pointer;flex:none}
.iosims-switch input{position:absolute;width:1px;height:1px;opacity:0;margin:0;pointer-events:none}
.iosims-switch-track{width:36px;height:20px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);display:inline-flex;align-items:center;padding:2px;transition:background .15s ease,border-color .15s ease}
.iosims-switch-thumb{width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-secondary);transition:transform .15s ease,background .15s ease}
.iosims-switch input:checked + .iosims-switch-track{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.iosims-switch input:checked + .iosims-switch-track .iosims-switch-thumb{transform:translateX(16px);background:#fff}
.iosims-switch input:focus-visible + .iosims-switch-track{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.iosims-check{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--dsw-alias-label-secondary);cursor:pointer;user-select:none}
.iosims-check input{accent-color:var(--dsw-alias-brand-primary);margin:0}
.iosims-groups{display:flex;flex-direction:column;gap:0}
.iosims-group{display:flex;flex-direction:column;gap:8px;min-width:0;padding:14px 0 16px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.iosims-group-head-row{position:relative;display:flex;align-items:center;gap:4px;border-radius:8px;transition:background .15s ease,opacity .15s ease}
.iosims-group-head-row[data-dragging="true"]{opacity:.5;background:var(--dsw-alias-bg-layer-2)}
.iosims-group-head-row[data-drop="before"],.iosims-group-head-row[data-drop="after"]{background:var(--dsw-alias-bg-layer-1)}
.iosims-group-head-row[data-drop="before"]::before,.iosims-group-head-row[data-drop="after"]::after{content:'';position:absolute;left:2px;right:2px;height:2px;border-radius:2px;background:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent);pointer-events:none;z-index:3}
.iosims-group-head-row[data-drop="before"]::before{top:-6px}
.iosims-group-head-row[data-drop="after"]::after{bottom:-6px}
.iosims-group-grip{display:inline-flex;align-items:center;justify-content:center;width:14px;height:24px;border-radius:5px;color:var(--dsw-alias-label-secondary);cursor:grab;flex:none;opacity:.7;transition:background .12s ease,color .12s ease,opacity .12s ease}
.iosims-group-grip:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);opacity:1}
.iosims-group-grip:active{cursor:grabbing}
.iosims-group-grip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.iosims-group-head{display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:2px 2px 4px;border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer;text-align:left}
.iosims-group-head:hover .iosims-group-name{color:var(--dsw-alias-label-primary)}
.iosims-chevron{display:inline-flex;width:12px;color:var(--dsw-alias-label-secondary);transition:transform .15s ease;transform:rotate(0deg);flex:none}
.iosims-chevron[data-open="true"]{transform:rotate(90deg)}
.iosims-folder{flex:none;color:var(--dsw-alias-label-secondary)}
.iosims-group-name{font-weight:650;color:var(--dsw-alias-label-primary);white-space:nowrap;flex:none;max-width:260px;overflow:hidden;text-overflow:ellipsis}
.iosims-group-path{color:var(--dsw-alias-label-secondary);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:40px;font-variant-numeric:tabular-nums}
.iosims-group-count{flex:none;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:10.5px;font-weight:650;display:inline-flex;align-items:center;justify-content:center}
.iosims-lock{color:var(--dsw-alias-label-primary);font-weight:600}
.iosims-list{display:flex;flex-direction:column;gap:10px}
.iosims-row{position:relative;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:12px;padding:13px 14px;display:flex;flex-direction:column;gap:11px;transition:border-color .15s ease,background .15s ease,opacity .15s ease,transform .15s ease}
.iosims-row:hover{border-color:var(--dsw-alias-border-l2)}
.iosims-row[data-status="running"]{border-color:var(--dsw-alias-brand-primary)}
.iosims-row[data-status="failed"]{border-color:var(--dsw-alias-state-error-primary)}
.iosims-row-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
.iosims-session{display:flex;align-items:flex-start;gap:9px;min-width:0}
.iosims-grip{display:inline-flex;align-items:center;justify-content:center;width:16px;height:22px;border-radius:5px;color:var(--dsw-alias-label-secondary);cursor:grab;flex:none;margin-top:1px;opacity:.8;transition:background .12s ease,color .12s ease,opacity .12s ease}
.iosims-grip:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);opacity:1}
.iosims-grip:active{cursor:grabbing}
.iosims-grip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.iosims-row[data-dragging="true"]{opacity:.5;transform:scale(.997);border-style:dashed;background:var(--dsw-alias-bg-layer-2);box-shadow:0 10px 24px rgba(0,0,0,.12)}
.iosims-row[data-drop="before"],.iosims-row[data-drop="after"]{background:var(--dsw-alias-bg-layer-2)}
.iosims-row[data-drop="before"]::before,.iosims-row[data-drop="after"]::after{content:'';position:absolute;left:8px;right:8px;height:2px;border-radius:2px;background:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 18%,transparent);pointer-events:none;z-index:3}
.iosims-row[data-drop="before"]::before{top:-6px}
.iosims-row[data-drop="after"]::after{bottom:-6px}
.iosims-dot{width:7px;height:7px;border-radius:50%;margin-top:6px;flex:none;background:var(--dsw-alias-state-idle-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-idle-primary) 18%,transparent)}
.iosims-dot[data-status="running"]{background:var(--dsw-alias-brand-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-brand-primary) 20%,transparent);animation:iosims-pulse 1.6s ease-in-out infinite}
.iosims-dot[data-status="passed"]{background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-success-primary) 18%,transparent)}
.iosims-dot[data-status="failed"]{background:var(--dsw-alias-state-error-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-error-primary) 18%,transparent)}
.iosims-dot[data-status="stopped"],.iosims-dot[data-status="interrupted"],.iosims-dot[data-status="blocked"]{background:var(--dsw-alias-state-warn-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--dsw-alias-state-warn-primary) 18%,transparent)}
@keyframes iosims-pulse{0%,100%{opacity:1}50%{opacity:.45}}
.iosims-session-text{min-width:0}
.iosims-session-title{font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:520px}
.iosims-session-meta{font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:560px;font-variant-numeric:tabular-nums}
.iosims-chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:2px 9px;font-size:11.5px;font-weight:600;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);white-space:nowrap;font-variant-numeric:tabular-nums}
.iosims-chip[data-status="running"]{color:var(--dsw-alias-brand-primary);border-color:color-mix(in srgb,var(--dsw-alias-brand-primary) 55%,transparent)}
.iosims-chip[data-status="passed"]{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 55%,transparent)}
.iosims-chip[data-status="failed"]{color:var(--dsw-alias-state-error-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 55%,transparent)}
.iosims-chip[data-status="stopped"],.iosims-chip[data-status="interrupted"],.iosims-chip[data-status="blocked"]{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 55%,transparent)}
.iosims-assign{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.iosims-assign-label{font-size:10.5px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-secondary);text-transform:uppercase}
.iosims-assign-select{height:28px;min-width:170px;max-width:280px;font-size:12px}
.iosims-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.iosims-field > span{font-size:10.5px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-secondary);text-transform:uppercase}
.iosims-select,.iosims-input{height:30px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:0 8px;font:inherit;font-size:12.5px;min-width:120px;max-width:230px}
.iosims-select:focus-visible,.iosims-input:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.iosims-select:disabled,.iosims-input:disabled{opacity:.55;cursor:not-allowed}
.iosims-input.scheme{min-width:120px;max-width:170px}
.iosims-buttons{display:flex;align-items:center;gap:7px;margin-left:auto;flex-wrap:wrap}
.iosims-detail{border-top:1px dashed var(--dsw-alias-border-l1);padding-top:10px;display:flex;flex-direction:column;gap:9px}
.iosims-detail-head{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.iosims-detail-head b{color:var(--dsw-alias-label-primary);font-weight:600}
.iosims-log{margin:0;padding:10px 12px;border-radius:9px;background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.55;white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto;color:var(--dsw-alias-label-secondary)}
.iosims-shot{display:block;max-width:230px;max-height:420px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2)}
.iosims-shot-link{display:inline-flex;align-self:flex-start}
.iosims-error{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);border-radius:10px;padding:9px 12px;font-size:12.5px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,transparent)}
.iosims-error-text{white-space:pre-wrap;word-break:break-word}
.iosims-empty{border:1px dashed var(--dsw-alias-border-l2);border-radius:12px;padding:28px 22px;text-align:center}
.iosims-empty-title{font-size:13.5px;font-weight:600;margin:0 0 6px}
.iosims-empty-body{margin:0 auto;font-size:12.5px;color:var(--dsw-alias-label-secondary);max-width:460px}
.iosims-more{align-self:center;margin:16px 0 2px}
.iosims-settings{border-top:1px solid var(--dsw-alias-border-l1);margin-top:4px;padding-top:16px;display:flex;flex-direction:column;gap:9px}
.iosims-settings-title{font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}
.iosims-settings-row{display:flex;gap:18px;flex-wrap:wrap}
.iosims-foot{font-size:11.5px;color:var(--dsw-alias-label-secondary);line-height:1.6}
.iosims-command{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.iosims-icon{position:relative;display:inline-flex;align-items:center;justify-content:center;color:inherit}
.iosims-icon svg{display:block}
.iosims-icon-dot{position:absolute;top:-1px;right:-1px;width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-error-primary);box-shadow:0 0 0 2px var(--dsw-specific-sidebar-fill)}
.iosims-tip{position:fixed;z-index:90;max-width:280px;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font-size:11.5px;line-height:1.55;box-shadow:0 10px 26px rgba(0,0,0,.22);pointer-events:none;animation:iosims-tip-in .12s ease-out}
@keyframes iosims-tip-in{from{opacity:0;transform:translateY(3px)}to{opacity:1;transform:none}}
.iosims-toast-wrap{position:fixed;right:22px;bottom:22px;z-index:60;display:flex;flex-direction:column;gap:10px;pointer-events:none}
.iosims-toast{pointer-events:auto;width:380px;max-width:calc(100vw - 44px);border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);border-radius:12px;padding:13px 14px;box-shadow:0 18px 44px rgba(0,0,0,.28);display:flex;flex-direction:column;gap:7px;animation:iosims-rise .18s ease-out}
@keyframes iosims-rise{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
.iosims-toast-title{font-size:13px;font-weight:650;display:flex;align-items:center;gap:7px}
.iosims-toast-title .iosims-dot{margin-top:0}
.iosims-toast-main{display:flex;gap:11px;align-items:flex-start}
.iosims-toast-text{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.iosims-toast-body{font-size:12px;color:var(--dsw-alias-label-secondary);word-break:break-word}
.iosims-toast-detail{font-size:11.5px;color:var(--dsw-alias-label-primary);word-break:break-word}
.iosims-toast-sub{font-size:11px;color:var(--dsw-alias-label-secondary);word-break:break-word}
.iosims-toast-shot{width:56px;height:122px;object-fit:cover;object-position:top;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);flex:none}
.iosims-toast-actions{display:flex;gap:7px;margin-top:4px;flex-wrap:wrap}
`

    // ------------------------------------------------------------------ store

    function createStore() {
      let snapshot = { state: null, error: null, loading: true, unread: 0, toast: null }
      const listeners = new Set()
      const statuses = new Map()
      let primed = false
      let timer = null
      let poll = null
      let toastTimer = null
      let uiTimer = null
      let inflight = null

      /**
       * Persist panel UI state twice: localStorage makes a remount immediate,
       * the Host copy survives a different page origin (the Web port changes
       * between restarts) and lets the panel rebuild its state after reload.
       */
      function saveUi(next) {
        try {
          localStorage.setItem(UI_KEY, JSON.stringify(next))
        } catch {}
        if (uiTimer) clearTimeout(uiTimer)
        uiTimer = setTimeout(() => {
          uiTimer = null
          fetch(`${API}/action`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'ui', ...next }),
          }).catch(() => {})
        }, 250)
      }

      function publish(patch) {
        snapshot = { ...snapshot, ...patch }
        for (const listener of listeners) {
          try {
            listener(snapshot)
          } catch {}
        }
      }

      function showToast(job) {
        if (toastTimer) clearTimeout(toastTimer)
        publish({ toast: job })
        toastTimer = setTimeout(() => {
          toastTimer = null
          publish({ toast: null })
        }, 30000)
      }

      async function load(force) {
        if (inflight) return inflight
        if (!force && typeof document !== 'undefined' && document.hidden) return
        inflight = (async () => {
          try {
            const response = await fetch(`${API}/state`, {
              headers: { accept: 'application/json' },
              cache: 'no-store',
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            const next = await response.json()
            const finished = []
            if (primed) {
              for (const job of next.jobs ?? []) {
                const before = statuses.get(job.id)
                if (before && before !== job.status && ['passed', 'failed', 'stopped'].includes(job.status)) {
                  finished.push(job)
                }
              }
            }
            for (const job of next.jobs ?? []) statuses.set(job.id, job.status)
            publish({
              state: next,
              error: null,
              loading: false,
              unread: snapshot.unread + finished.length,
            })
            primed = true
            if (finished.length) showToast(finished[0])
          } catch (error) {
            publish({ error: error?.message ?? String(error), loading: false })
          } finally {
            inflight = null
          }
        })()
        return inflight
      }

      async function act(body) {
        let response
        try {
          response = await fetch(`${API}/action`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          })
        } catch (error) {
          throw new Error(error?.message ?? String(error))
        }
        let data = null
        try {
          data = await response.json()
        } catch {}
        if (!response.ok || data?.ok === false) {
          throw new Error(data?.error?.message ?? `HTTP ${response.status}`)
        }
        await load(true)
        return data
      }

      function start() {
        load()
        poll = setInterval(() => load(false), 2500)
        const onVisibility = () => {
          if (!document.hidden) load()
        }
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
          if (poll) clearInterval(poll)
          if (toastTimer) clearTimeout(toastTimer)
          if (uiTimer) clearTimeout(uiTimer)
          document.removeEventListener('visibilitychange', onVisibility)
        }
      }

      return {
        get: () => snapshot,
        subscribe(listener) {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        start,
        load,
        act,
        saveUi,
        markRead() {
          if (snapshot.unread) publish({ unread: 0 })
        },
        dismissToast() {
          if (toastTimer) clearTimeout(toastTimer)
          toastTimer = null
          publish({ toast: null })
        },
        clearError() {
          if (snapshot.error) publish({ error: null })
        },
      }
    }

    function useStore(store) {
      const [snap, setSnap] = React.useState(store.get())
      React.useEffect(() => store.subscribe(setSnap), [store])
      return snap
    }

    // ------------------------------------------------------------------ formatting

    function shortPath(value) {
      if (!value) return ''
      const home = typeof value === 'string' ? value : ''
      const parts = home.split('/').filter(Boolean)
      if (parts.length <= 2) return home
      return `…/${parts.slice(-2).join('/')}`
    }

    function formatElapsed(ms) {
      const total = Math.max(0, Math.round(ms / 1000))
      const minutes = Math.floor(total / 60)
      const seconds = total % 60
      if (minutes >= 60) {
        const hours = Math.floor(minutes / 60)
        return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      }
      return `${minutes}:${String(seconds).padStart(2, '0')}`
    }

    function relativeTime(t, time, now) {
      const delta = Math.max(0, now - time)
      if (delta < 60000) return t('time.justNow')
      if (delta < 3600000) return `${Math.floor(delta / 60000)} ${t('time.minutes')}`
      return `${Math.floor(delta / 3600000)} ${t('time.hours')}`
    }

    function scoreSession(session) {
      return (session.activeJob ? 3 : 0) + (session.assignment ? 2 : 0) + (session.lastJob ? 1 : 0)
    }

    const SORT_RANK = { running: 0, queued: 1, failed: 2, passed: 3, stopped: 4, interrupted: 5, idle: 6 }

    function compareSessions(left, right, sortBy, manualOrder = []) {
      if (sortBy === 'manual') {
        const index = (session) => {
          const at = manualOrder.indexOf(session.id)
          return at === -1 ? Number.MAX_SAFE_INTEGER : at
        }
        const delta = index(left) - index(right)
        if (delta) return delta
        return (right.createdAt ?? 0) - (left.createdAt ?? 0)
      }
      if (sortBy === 'created') return (right.createdAt ?? 0) - (left.createdAt ?? 0)
      if (sortBy === 'title') return (left.title || '').localeCompare(right.title || '', 'zh-Hans-CN')
      if (sortBy === 'device') {
        const leftDevice = left.assignment?.model ?? '\uffff'
        const rightDevice = right.assignment?.model ?? '\uffff'
        return (
          leftDevice.localeCompare(rightDevice, 'zh-Hans-CN') ||
          (left.assignment?.name ?? '').localeCompare(right.assignment?.name ?? '', 'zh-Hans-CN')
        )
      }
      if (sortBy === 'status') {
        const delta = (SORT_RANK[statusOf(left)] ?? 9) - (SORT_RANK[statusOf(right)] ?? 9)
        if (delta) return delta
      } else {
        const delta = scoreSession(right) - scoreSession(left)
        if (delta) return delta
      }
      return (right.lastJob?.startedAt ?? right.createdAt ?? 0) - (left.lastJob?.startedAt ?? left.createdAt ?? 0)
    }

    function shortenHome(value) {
      if (!value) return ''
      return value.replace(/^\/Users\/[^/]+/, '~')
    }

    function statusOf(session) {
      return session.activeJob?.status ?? session.lastJob?.status ?? 'idle'
    }

    function jobOf(session) {
      return session.activeJob ?? session.lastJob ?? null
    }

    // ------------------------------------------------------------------ persisted panel UI

    const UI_KEY = 'dsh-ios-sim.ui.v1'
    const UI_DEFAULTS = {
      onlyAssigned: false,
      showAll: false,
      collapsed: [],
      openLogs: [],
      hiddenShots: [],
      sortBy: 'manual',
      manualOrder: [],
      groupOrder: [],
      updatedAt: 0,
    }

    function readUi() {
      try {
        const raw = localStorage.getItem(UI_KEY)
        if (!raw) return null
        const value = JSON.parse(raw)
        return value && typeof value === 'object' ? value : null
      } catch {
        return null
      }
    }

    function gripIcon() {
      return h(
        'svg',
        { width: 10, height: 14, viewBox: '0 0 10 14', fill: 'currentColor', 'aria-hidden': true },
        [2, 7, 12].flatMap((cy) => [2, 8].map((cx) => h('circle', { key: `${cx}-${cy}`, cx, cy, r: 1.15 }))),
      )
    }

    // ------------------------------------------------------------------ icon

    function IosSimIcon(props) {
      const { size = 18, store } = props
      const snap = useStore(store)
      return h(
        'span',
        { className: 'iosims-icon', style: { width: size, height: size } },
        h(
          'svg',
          {
            width: size,
            height: size,
            viewBox: '0 0 18 18',
            fill: 'none',
            stroke: 'currentColor',
            strokeWidth: 1.5,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            'aria-hidden': true,
          },
          h('rect', { x: 4.4, y: 1.6, width: 9.2, height: 14.8, rx: 2.4 }),
          h('path', { d: 'M7.4 4.1h3.2' }),
          h('circle', { cx: 9, cy: 11.3, r: 2.9, opacity: 0.16, fill: 'currentColor', stroke: 'none' }),
          h('path', { d: 'M7.6 11.3l1 1.05 1.9-2' }),
        ),
        snap.unread > 0 ? h('span', { className: 'iosims-icon-dot' }) : null,
      )
    }

    // ------------------------------------------------------------------ page pieces

    function ErrorBanner(props) {
      const { store, t } = props
      return h(
        'div',
        { className: 'iosims-error', role: 'alert' },
        h('span', { className: 'iosims-error-text' }, `${t('error.load')} · ${props.message}`),
        h(
          'button',
          {
            className: 'iosims-btn small',
            onClick: () => {
              store.clearError()
              store.load(true)
            },
          },
          t('action.retry'),
        ),
      )
    }

    function JobDetail(props) {
      const { job, t, now, logOpen, shotOpen, onToggleLog, onToggleShot } = props
      const running = job.status === 'running' || job.status === 'queued'
      const elapsed = running ? now - job.startedAt : job.durationMs
      return h(
        'div',
        { className: 'iosims-detail' },
        h(
          'div',
          { className: 'iosims-detail-head' },
          h('span', { className: 'iosims-chip', 'data-status': job.status }, t(`status.${job.status}`)),
          h('span', null, t(`step.${job.step}`)),
          h('span', null, `${t('job.elapsed')} ${formatElapsed(elapsed)}`),
          job.scheme ? h('span', null, `scheme `, h('b', null, job.scheme)) : null,
          job.summary ? h('b', null, job.summary) : null,
          job.stats && (job.stats.passed || job.stats.failed)
            ? h(
                'span',
                null,
                `${job.stats.passed} ${t('job.passedCount')} / ${job.stats.failed} ${t('job.failedCount')}`,
              )
            : null,
          h(
            'div',
            { className: 'iosims-buttons' },
            h(
              'button',
              { className: 'iosims-btn small', onClick: onToggleLog },
              `${t('action.log')}${logOpen ? ' ▴' : ' ▾'}`,
            ),
            job.shot
              ? h(
                  'button',
                  { className: 'iosims-btn small', onClick: onToggleShot },
                  t('action.shot'),
                )
              : null,
          ),
        ),
        job.command
          ? h('div', { className: 'iosims-command', title: job.command }, job.command)
          : null,
        job.detail ? h('div', { className: 'iosims-foot' }, job.detail) : null,
        job.error
          ? h('div', { className: 'iosims-error-text', style: { color: 'var(--dsw-alias-state-error-primary)' } }, job.error)
          : null,
        logOpen
          ? h(
              'div',
              null,
              h('pre', { className: 'iosims-log' }, job.tail || t('job.noLog')),
              job.logUrl
                ? h(
                    'a',
                    {
                      className: 'iosims-btn small',
                      style: { marginTop: 6, display: 'inline-flex' },
                      href: job.logUrl,
                      target: '_blank',
                      rel: 'noreferrer',
                    },
                    t('job.fullLog'),
                  )
                : null,
            )
          : null,
        shotOpen && job.shot
          ? h(
              'a',
              { className: 'iosims-shot-link', href: job.shot, target: '_blank', rel: 'noreferrer' },
              h('img', { className: 'iosims-shot', src: job.shot, alt: t('job.shotAlt'), loading: 'lazy' }),
            )
          : null,
      )
    }

    function SessionRow(props) {
      const {
        session,
        devices,
        store,
        t,
        now,
        ui,
        onUi,
        manual,
        dragging,
        sessionDragActive,
        drop,
        onDragStart,
        onDragEnd,
        onDragOverRow,
        onDragLeaveRow,
        onDropRow,
        onMoveBy,
        onTip,
        onTipMove,
        onTipHide,
      } = props
      const job = jobOf(session)
      const status = statusOf(session)

      const toggleUiList = (key, id) => {
        const list = new Set(ui[key] ?? [])
        if (list.has(id)) list.delete(id)
        else list.add(id)
        onUi({ [key]: [...list].slice(-200) })
      }

      return h(
        'div',
        {
          className: 'iosims-row',
          'data-status': status,
          'data-dragging': dragging ? 'true' : undefined,
          'data-drop': drop ? (drop.after ? 'after' : 'before') : undefined,
          onDragOver: (event) => {
            if (!manual || !sessionDragActive) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            const rect = event.currentTarget.getBoundingClientRect()
            onDragOverRow(event.clientY > rect.top + rect.height / 2)
          },
          onDragLeave: (event) => {
            if (!manual || !sessionDragActive) return
            if (event.currentTarget.contains(event.relatedTarget)) return
            onDragLeaveRow()
          },
          onDrop: (event) => {
            if (!manual || !sessionDragActive) return
            event.preventDefault()
            const rect = event.currentTarget.getBoundingClientRect()
            onDropRow(event.clientY > rect.top + rect.height / 2)
          },
        },
        h(
          'div',
          { className: 'iosims-row-head' },
          h(
            'div',
            { className: 'iosims-session' },
            manual
              ? h(
                  'span',
                  {
                    className: 'iosims-grip',
                    draggable: true,
                    role: 'button',
                    tabIndex: 0,
                    title: t('sort.drag'),
                    'aria-label': t('sort.drag'),
                    onMouseEnter: (event) => onTip(event, t('sort.help.sessionDrag')),
                    onMouseMove: onTipMove,
                    onMouseLeave: onTipHide,
                    onDragStart: (event) => {
                      onTipHide()
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', session.id)
                      const row = event.currentTarget.closest('.iosims-row')
                      if (row) event.dataTransfer.setDragImage(row, 28, 24)
                      onDragStart()
                    },
                    onDragEnd: onDragEnd,
                    onKeyDown: (event) => {
                      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                      event.preventDefault()
                      onMoveBy(event.key === 'ArrowUp' ? -1 : 1)
                    },
                  },
                  gripIcon(),
                )
              : null,
            h('span', { className: 'iosims-dot', 'data-status': status, 'aria-hidden': true }),
            h(
              'div',
              { className: 'iosims-session-text' },
              h('div', { className: 'iosims-session-title', title: session.title }, session.title),
              h(
                'div',
                { className: 'iosims-session-meta', title: session.cwd },
                session.assignment
                  ? `${session.assignment.model} · ${session.assignment.runtime}`
                  : job
                    ? t('device.unknown')
                    : t('empty.observed'),
              ),
            ),
          ),
          job
            ? h(
                'span',
                { className: 'iosims-chip', 'data-status': job.status },
                job.status === 'running' ? `${t('status.running')} · ${t(`step.${job.step}`)}` : t(`status.${job.status}`),
                job.status !== 'running' && job.endedAt ? ` · ${relativeTime(t, job.endedAt, now)}` : '',
              )
            : h('span', { className: 'iosims-chip' }, t('status.unverified')),
        ),
        h(
          'div',
          { className: 'iosims-assign' },
          h('span', { className: 'iosims-assign-label' }, t('assign.label')),
          h(
            'select',
            {
              className: 'iosims-select iosims-assign-select',
              value: session.assignment?.udid ?? '',
              'aria-label': t('assign.label'),
              onChange: (event) => {
                const value = event.target.value || null
                store.act({ action: 'assign', sessionId: session.id, deviceUdid: value }).catch(() => {})
              },
            },
            h('option', { value: '' }, t('assign.none')),
            session.assignment && !devices.some((device) => device.udid === session.assignment.udid)
              ? h(
                  'option',
                  { value: session.assignment.udid },
                  `${session.assignment.model} · ${session.assignment.runtime} · ${t('status.interrupted')}`,
                )
              : null,
            devices.map((device) =>
              h(
                'option',
                {
                  key: device.udid,
                  value: device.udid,
                  disabled:
                    Boolean(device.assignedTo && device.assignedTo.sessionId !== session.id) ||
                    Boolean(device.busy),
                },
                `${device.model ?? device.name} · ${device.runtime}` +
                  (device.assignedTo && device.assignedTo.sessionId !== session.id
                    ? ` · ${device.assignedTo.title}`
                    : ''),
              ),
            ),
          ),
          job?.mismatch
            ? h('span', { className: 'iosims-chip', 'data-status': 'failed' }, t('warn.mismatch'))
            : null,
          job?.conflict
            ? h('span', { className: 'iosims-chip', 'data-status': 'failed' }, t('warn.conflict'))
            : null,
          job?.assumedDevice ? h('span', { className: 'iosims-chip' }, t('warn.assumed')) : null,
        ),
        job
          ? h(JobDetail, {
              job,
              t,
              now,
              logOpen: (ui.openLogs ?? []).includes(job.id),
              shotOpen: Boolean(job.shot) && !(ui.hiddenShots ?? []).includes(job.id),
              onToggleLog: () => toggleUiList('openLogs', job.id),
              onToggleShot: () => toggleUiList('hiddenShots', job.id),
            })
          : null,
      )
    }

    function SettingsRow(props) {
      const { settings, store, t } = props
      const [busy, setBusy] = React.useState(false)
      async function toggle(key, value) {
        setBusy(true)
        try {
          await store.act({ action: 'settings', [key]: value })
        } catch {
        } finally {
          setBusy(false)
        }
      }
      return h(
        'div',
        { className: 'iosims-settings' },
        h('div', { className: 'iosims-settings-title' }, t('settings.title')),
        h(
          'div',
          { className: 'iosims-settings-row' },
          h(
            'label',
            { className: 'iosims-check' },
            h('input', {
              type: 'checkbox',
              checked: Boolean(settings.notify),
              disabled: busy,
              onChange: (event) => toggle('notify', event.target.checked),
            }),
            t('settings.notify'),
          ),

        ),
      )
    }

    function IosSimPage(props) {
      const { store, t, layoutSelect } = props
      const snap = useStore(store)
      const state = snap.state
      const [now, setNow] = React.useState(Date.now())
      const [busy, setBusy] = React.useState(false)
      const [dragId, setDragId] = React.useState(null)
      const [dragGroupKey, setDragGroupKey] = React.useState(null)
      const [sessionDrop, setSessionDrop] = React.useState(null)
      const [groupDrop, setGroupDrop] = React.useState(null)
      const [tip, setTip] = React.useState(null)
      const localUi = React.useMemo(() => readUi(), [])
      const [ui, setUi] = React.useState(() => ({ ...UI_DEFAULTS, ...(localUi ?? {}) }))
      const uiHydrated = React.useRef(false)
      const uiTouched = React.useRef(false)

      React.useEffect(() => {
        if (uiHydrated.current || uiTouched.current || !state?.ui) return
        uiHydrated.current = true
        // A same-origin remount already has the freshest copy in localStorage;
        // after a port change localStorage is empty and the Host copy wins.
        setUi((previous) => {
          const hostTime = Number(state.ui.updatedAt) || 0
          const localTime = Number(previous.updatedAt) || 0
          return hostTime >= localTime ? { ...previous, ...state.ui } : { ...state.ui, ...previous }
        })
      }, [state?.ui])

      const updateUi = (patch) => {
        uiTouched.current = true
        setUi((previous) => {
          const next = { ...previous, ...patch, updatedAt: Date.now() }
          store.saveUi(next)
          return next
        })
      }

      React.useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(timer)
      }, [])

      React.useEffect(() => {
        if (snap.unread) store.markRead()
      }, [snap.unread])

      React.useEffect(() => {
        store.load()
      }, [])

      const devices = state?.devices ?? []
      const sessions = state?.sessions ?? []
      const free = devices.filter((device) => !device.boundTo && !device.busy).length
      const running = sessions.filter((session) => session.activeJob).length
      const filtered = ui.onlyAssigned ? sessions.filter((session) => session.activeJob) : sessions
      const sortBy = ui.sortBy ?? 'activity'
      const sorted = filtered.slice().sort((left, right) => compareSessions(left, right, sortBy, ui.manualOrder ?? []))
      const visible = ui.showAll ? sorted : sorted.slice(0, 12)
      const workspaceCount = new Set(filtered.map((session) => session.workspace || session.cwd || '')).size

      const groups = []
      const groupByKey = new Map()
      for (const session of visible) {
        const key = session.workspace || session.cwd || ''
        let group = groupByKey.get(key)
        if (!group) {
          group = {
            key,
            name: session.workspaceName || (key ? key.split('/').filter(Boolean).pop() : '未设置工作区'),
            path: key,
            sessions: [],
          }
          groupByKey.set(key, group)
          groups.push(group)
        }
        group.sessions.push(session)
      }
      groups.sort((left, right) => {
        if (sortBy === 'title') return left.name.localeCompare(right.name, 'zh-Hans-CN')
        if (sortBy === 'manual') {
          const index = (group) => {
            const at = (ui.groupOrder ?? []).indexOf(group.key)
            return at === -1 ? Number.MAX_SAFE_INTEGER : at
          }
          return index(left) - index(right) || left.name.localeCompare(right.name, 'zh-Hans-CN')
        }
        return compareSessions(left.sessions[0], right.sessions[0], sortBy, ui.manualOrder ?? [])
      })

      const toggleGroup = (key) => {
        const next = new Set(ui.collapsed ?? [])
        if (next.has(key)) next.delete(key)
        else next.add(key)
        updateUi({ collapsed: [...next].slice(-200) })
      }

      const changeSort = (value) => {
        if (value === 'manual') {
          // Entering the default order should not jump the list: seed both
          // orders from the arrangement the user is currently looking at.
          const next = { sortBy: 'manual' }
          if (!(ui.manualOrder ?? []).length) {
            const order = sorted.map((session) => session.id)
            for (const session of sessions) if (!order.includes(session.id)) order.push(session.id)
            next.manualOrder = order
          }
          if (!(ui.groupOrder ?? []).length) next.groupOrder = groups.map((group) => group.key)
          updateUi(next)
        } else {
          updateUi({ sortBy: value })
        }
      }

      const reorderSession = (sourceId, targetId, after) => {
        if (!sourceId || !targetId || sourceId === targetId) return
        const source = sessions.find((session) => session.id === sourceId)
        const target = sessions.find((session) => session.id === targetId)
        // Manual reordering stays inside one workspace group; a cross-group drop
        // would silently move a session's position relative to unrelated rows.
        if (!source || !target || (source.workspace || '') !== (target.workspace || '')) return
        const known = new Set(sessions.map((session) => session.id))
        const base = (ui.manualOrder ?? []).filter((id) => known.has(id))
        for (const session of sorted) if (!base.includes(session.id)) base.push(session.id)
        for (const session of sessions) if (!base.includes(session.id)) base.push(session.id)
        const from = base.indexOf(sourceId)
        if (from === -1) return
        base.splice(from, 1)
        let to = base.indexOf(targetId)
        if (to === -1) to = base.length
        if (after) to += 1
        base.splice(to, 0, sourceId)
        setDragId(null)
        setSessionDrop(null)
        updateUi({ manualOrder: base, sortBy: 'manual' })
      }

      const moveSession = (sessionId, delta, group) => {
        const ids = group.sessions.map((session) => session.id)
        const at = ids.indexOf(sessionId)
        const target = ids[at + delta]
        if (!target) return
        reorderSession(sessionId, target, delta > 0)
      }

      const reorderGroup = (sourceKey, targetKey, after) => {
        if (!sourceKey || !targetKey || sourceKey === targetKey) return
        const known = new Set(groups.map((group) => group.key))
        const base = (ui.groupOrder ?? []).filter((key) => known.has(key))
        for (const group of groups) if (!base.includes(group.key)) base.push(group.key)
        const from = base.indexOf(sourceKey)
        if (from === -1) return
        base.splice(from, 1)
        let to = base.indexOf(targetKey)
        if (to === -1) to = base.length
        if (after) to += 1
        base.splice(to, 0, sourceKey)
        setDragGroupKey(null)
        setGroupDrop(null)
        updateUi({ groupOrder: base, sortBy: 'manual' })
      }

      const moveGroupBy = (key, delta) => {
        const keys = groups.map((group) => group.key)
        const at = keys.indexOf(key)
        const target = keys[at + delta]
        if (target) reorderGroup(key, target, delta > 0)
      }

      const manual = sortBy === 'manual'

      const endDrag = () => {
        setDragId(null)
        setDragGroupKey(null)
        setSessionDrop(null)
        setGroupDrop(null)
        setTip(null)
      }

      const showTip = (event, text) => {
        setTip({
          x: Math.min(event.clientX + 14, window.innerWidth - 300),
          y: Math.min(event.clientY + 18, window.innerHeight - 90),
          text,
        })
      }

      const moveTip = (event) => {
        setTip((current) =>
          current
            ? {
                ...current,
                x: Math.min(event.clientX + 14, window.innerWidth - 300),
                y: Math.min(event.clientY + 18, window.innerHeight - 90),
              }
            : current,
        )
      }

      const hideTip = () => setTip(null)

      React.useEffect(() => {
        const dragging = Boolean(dragId || dragGroupKey)
        document.body.style.cursor = dragging ? 'grabbing' : ''
        return () => {
          document.body.style.cursor = ''
        }
      }, [dragId, dragGroupKey])

      return h(
        'div',
        { className: 'iosims-page' },
        h(
          'div',
          { className: 'iosims-inner' },
          h(
            'header',
            { className: 'iosims-head' },
            h(
              'div',
              null,
              h('h1', { className: 'iosims-title' }, t('page.title')),
              h('p', { className: 'iosims-sub' }, t('page.subtitle')),
            ),
            h(
              'div',
              { className: 'iosims-stats' },
              h('span', { className: 'iosims-stat' }, h('b', null, devices.length), ` ${t('page.devices')}`),
              h('span', { className: 'iosims-stat' }, h('b', null, free), ` ${t('page.free')}`),
              running ? h('span', { className: 'iosims-stat' }, h('b', null, running), ` ${t('status.running')}`) : null,
              h(
                'label',
                {
                  className: 'iosims-sort',
                  onMouseEnter: (event) => showTip(event, t(`sort.help.${ui.sortBy ?? 'manual'}`)),
                  onMouseMove: moveTip,
                  onMouseLeave: hideTip,
                },
                h('span', { className: 'iosims-sort-label' }, t('sort.label')),
                h(
                  'select',
                  {
                    className: 'iosims-select iosims-sort-select',
                    value: ui.sortBy ?? 'activity',
                    'aria-label': t('sort.label'),
                    onChange: (event) => {
                      hideTip()
                      changeSort(event.target.value)
                    },
                  },
                  h('option', { value: 'activity' }, t('sort.activity')),
                  h('option', { value: 'created' }, t('sort.created')),
                  h('option', { value: 'title' }, t('sort.title')),
                  h('option', { value: 'device' }, t('sort.device')),
                  h('option', { value: 'status' }, t('sort.status')),
                  h('option', { value: 'manual' }, t('sort.manual')),
                ),
              ),
              h(
                'button',
                {
                  className: 'iosims-btn small',
                  disabled: busy,
                  onClick: async () => {
                    setBusy(true)
                    try {
                      await store.load(true)
                    } finally {
                      setBusy(false)
                    }
                  },
                },
                t('action.refresh'),
              ),
            ),
          ),
          snap.error ? h(ErrorBanner, { store, t, message: snap.error }) : null,
          h(
            'section',
            { className: 'iosims-filter', 'aria-label': t('filter.assigned') },
            h(
              'span',
              { className: 'iosims-filter-icon', 'aria-hidden': true },
              h(
                'svg',
                {
                  width: 16,
                  height: 16,
                  viewBox: '0 0 16 16',
                  fill: 'none',
                  stroke: 'currentColor',
                  strokeWidth: 1.4,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                },
                h('path', { d: 'M2.2 3.2h11.6L9.4 8.6v4.3l-2.8 1.1V8.6z' }),
              ),
            ),
            h(
              'div',
              { className: 'iosims-filter-text' },
              h('div', { className: 'iosims-filter-title' }, t('filter.assigned')),
              h(
                'div',
                { className: 'iosims-filter-sub' },
                `${sessions.length} ${t('page.sessions')} · ${workspaceCount} ${t('page.workspaces')} · ${sessions.filter((session) => session.activeJob).length} ${t('page.verifying')}`,
              ),
            ),
            h(
              'label',
              { className: 'iosims-switch' },
              h('input', {
                type: 'checkbox',
                role: 'switch',
                checked: Boolean(ui.onlyAssigned),
                'aria-label': t('filter.assigned'),
                onChange: (event) => updateUi({ onlyAssigned: event.target.checked }),
              }),
              h(
                'span',
                { className: 'iosims-switch-track', 'aria-hidden': true },
                h('span', { className: 'iosims-switch-thumb' }),
              ),
            ),
          ),
          snap.loading && !state
            ? h('div', { className: 'iosims-empty' }, h('p', { className: 'iosims-empty-body' }, '…'))
            : sessions.length === 0
              ? h(
                  'div',
                  { className: 'iosims-empty' },
                  h('p', { className: 'iosims-empty-title' }, t('empty.title')),
                  h('p', { className: 'iosims-empty-body' }, t('empty.body')),
                )
              : visible.length === 0
                ? h(
                    'div',
                    { className: 'iosims-empty' },
                    h('p', { className: 'iosims-empty-title' }, t('empty.title')),
                    h('p', { className: 'iosims-empty-body' }, t('empty.filtered')),
                  )
                : h(
                  'div',
                  { className: 'iosims-groups' },
                  groups.map((group) => {
                    const open = !(ui.collapsed ?? []).includes(group.key)
                    const groupRunning = group.sessions.filter((session) => session.activeJob).length
                    return h(
                      'section',
                      { key: group.key || 'no-workspace', className: 'iosims-group' },
                      h(
                        'div',
                        {
                          className: 'iosims-group-head-row',
                          'data-dragging': dragGroupKey === group.key ? 'true' : undefined,
                          'data-drop':
                            groupDrop && groupDrop.key === group.key && dragGroupKey !== group.key
                              ? groupDrop.after
                                ? 'after'
                                : 'before'
                              : undefined,
                          onDragOver: (event) => {
                            if (!manual || !dragGroupKey) return
                            event.preventDefault()
                            event.dataTransfer.dropEffect = 'move'
                            const rect = event.currentTarget.getBoundingClientRect()
                            const after = event.clientY > rect.top + rect.height / 2
                            setGroupDrop((current) =>
                              current?.key === group.key && current.after === after
                                ? current
                                : { key: group.key, after },
                            )
                          },
                          onDragLeave: (event) => {
                            if (!manual) return
                            if (event.currentTarget.contains(event.relatedTarget)) return
                            setGroupDrop((current) => (current?.key === group.key ? null : current))
                          },
                          onDrop: (event) => {
                            if (!manual || !dragGroupKey) return
                            event.preventDefault()
                            const rect = event.currentTarget.getBoundingClientRect()
                            reorderGroup(dragGroupKey, group.key, event.clientY > rect.top + rect.height / 2)
                          },
                        },
                        manual
                          ? h(
                              'span',
                              {
                                className: 'iosims-group-grip',
                                draggable: true,
                                role: 'button',
                                tabIndex: 0,
                                title: t('sort.dragGroup'),
                                'aria-label': t('sort.dragGroup'),
                                onMouseEnter: (event) => showTip(event, t('sort.help.groupDrag')),
                                onMouseMove: moveTip,
                                onMouseLeave: hideTip,
                                onDragStart: (event) => {
                                  hideTip()
                                  event.dataTransfer.effectAllowed = 'move'
                                  event.dataTransfer.setData('text/plain', group.key)
                                  const head = event.currentTarget.closest('.iosims-group-head-row')
                                  if (head) event.dataTransfer.setDragImage(head, 16, 16)
                                  setDragGroupKey(group.key)
                                },
                                onDragEnd: endDrag,
                                onKeyDown: (event) => {
                                  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                                  event.preventDefault()
                                  moveGroupBy(group.key, event.key === 'ArrowUp' ? -1 : 1)
                                },
                              },
                              gripIcon(),
                            )
                          : null,
                        h(
                        'button',
                        {
                          type: 'button',
                          className: 'iosims-group-head',
                          onClick: () => toggleGroup(group.key),
                          'aria-expanded': open,
                        },
                        h('span', { className: 'iosims-chevron', 'data-open': open }, '▸'),
                        h(
                          'svg',
                          {
                            className: 'iosims-folder',
                            width: 14,
                            height: 14,
                            viewBox: '0 0 16 16',
                            fill: 'none',
                            stroke: 'currentColor',
                            strokeWidth: 1.4,
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round',
                            'aria-hidden': true,
                          },
                          h('path', {
                            d: 'M1.8 4.2c0-.7.6-1.2 1.2-1.2h3l1.4 1.6h5.3c.7 0 1.2.6 1.2 1.2v6c0 .7-.6 1.2-1.2 1.2H3c-.7 0-1.2-.6-1.2-1.2z',
                          }),
                        ),
                        h('span', { className: 'iosims-group-name', title: group.name }, group.name),
                        h('span', { className: 'iosims-group-path', title: group.path }, shortenHome(group.path)),
                        h('span', { className: 'iosims-group-count' }, String(group.sessions.length)),
                        groupRunning
                          ? h(
                              'span',
                              { className: 'iosims-chip', 'data-status': 'running' },
                              `${groupRunning} ${t('group.running')}`,
                            )
                          : null,
                        ),
                      ),
                      open
                        ? h(
                            'div',
                            { className: 'iosims-list' },
                            group.sessions.map((session) =>
                              h(SessionRow, {
                                key: session.id,
                                session,
                                devices,
                                store,
                                t,
                                now,
                                layoutSelect,
                                ui,
                                onUi: updateUi,
                                manual,
                                dragging: dragId === session.id,
                                sessionDragActive: Boolean(dragId),
                                drop:
                                  sessionDrop && sessionDrop.id === session.id && dragId !== session.id
                                    ? sessionDrop
                                    : null,
                                onDragStart: () => setDragId(session.id),
                                onDragEnd: endDrag,
                                onDragOverRow: (after) => {
                                  setGroupDrop(null)
                                  setSessionDrop((current) =>
                                    current?.id === session.id && current.after === after
                                      ? current
                                      : { id: session.id, after },
                                  )
                                },
                                onDragLeaveRow: () =>
                                  setSessionDrop((current) => (current?.id === session.id ? null : current)),
                                onDropRow: (after) => reorderSession(dragId, session.id, after),
                                onMoveBy: (delta) => moveSession(session.id, delta, group),
                                onTip: showTip,
                                onTipMove: moveTip,
                                onTipHide: hideTip,
                              }),
                            ),
                          )
                        : null,
                    )
                  }),
                  sorted.length > visible.length
                    ? h(
                        'button',
                        { className: 'iosims-btn iosims-more', onClick: () => updateUi({ showAll: true }) },
                        `${t('action.more')} (${sorted.length})`,
                      )
                    : sorted.length > 12 && ui.showAll
                      ? h('button', { className: 'iosims-btn iosims-more', onClick: () => updateUi({ showAll: false }) }, t('action.less'))
                      : null,
                ),
          h('div', { className: 'iosims-foot' }, t('page.foot')),
          state ? h(SettingsRow, { settings: state.settings ?? {}, store, t }) : null,
        ),
        tip
          ? h(
              'div',
              { className: 'iosims-tip', role: 'tooltip', style: { left: tip.x, top: tip.y } },
              tip.text,
            )
          : null,
      )
    }

    function IosSimToast(props) {
      const { store, t, layoutSelect } = props
      const snap = useStore(store)
      const job = snap.toast
      if (!job) return null
      const title =
        job.status === 'blocked'
          ? t('toast.blocked')
          : job.status === 'passed'
            ? t('toast.passed')
            : job.status === 'failed'
              ? t('toast.failed')
              : t('toast.stopped')
      const stats = job.stats
      const duration = formatElapsed((job.endedAt ?? Date.now()) - job.startedAt)
      const result = [
        job.summary,
        stats && (stats.passed || stats.failed)
          ? `${stats.passed} ${t('job.passedCount')} / ${stats.failed} ${t('job.failedCount')}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
      return h(
        'div',
        { className: 'iosims-toast-wrap' },
        h(
          'div',
          { className: 'iosims-toast', role: 'status', 'aria-live': 'polite' },
          h(
            'div',
            { className: 'iosims-toast-title' },
            h('span', { className: 'iosims-dot', 'data-status': job.status, 'aria-hidden': true }),
            title,
            h('span', { className: 'iosims-toast-sub', style: { fontWeight: 500, marginLeft: 'auto' } }, job.deviceModel),
          ),
          h(
            'div',
            { className: 'iosims-toast-main' },
            h(
              'div',
              { className: 'iosims-toast-text' },
              h('div', { className: 'iosims-toast-body' }, `${t('toast.workspace')} ${job.workspaceName || '—'}`),
              h('div', { className: 'iosims-toast-body' }, `${t('toast.session')}「${job.sessionTitle}」`),
              h(
                'div',
                { className: 'iosims-toast-detail' },
                `${job.deviceModel} · ${job.deviceRuntime}${job.scheme ? ` · ${job.scheme}` : ''}`,
              ),
              h(
                'div',
                { className: 'iosims-toast-sub' },
                `${t('toast.duration')} ${duration}${result ? ` · ${result}` : ''}`,
              ),
              job.detail ? h('div', { className: 'iosims-toast-sub' }, job.detail) : null,
              stats && stats.failedTests.length
                ? h('div', { className: 'iosims-toast-sub' }, `${t('job.failedTests')}: ${stats.failedTests.join('、')}`)
                : null,
            ),
            job.shot
              ? h('img', { className: 'iosims-toast-shot', src: job.shot, alt: t('job.shotAlt'), loading: 'lazy' })
              : null,
          ),
          h(
            'div',
            { className: 'iosims-toast-actions' },
            h(
              'button',
              {
                className: 'iosims-btn primary small',
                onClick: () => {
                  store.markRead()
                  store.dismissToast()
                  if (layoutSelect) layoutSelect()
                },
              },
              t('toast.view'),
            ),
            h(
              'button',
              {
                className: 'iosims-btn small',
                onClick: () => store.act({ action: 'open', sessionId: job.sessionId }).catch(() => {}),
              },
              t('toast.open'),
            ),
            h(
              'button',
              { className: 'iosims-btn ghost small', onClick: () => store.dismissToast() },
              t('toast.dismiss'),
            ),
          ),
        ),
      )
    }

    // ------------------------------------------------------------------ apply

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ios-simulator: dictionaries')
      const t = ctx.locale.bind(NS)
      const store = createStore()
      ctx.effect(() => store.start(), 'ios-simulator: poller')

      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-plugin', '@local/dsh-ios-simulator')
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, 'ios-simulator: styles')

      const layoutSelect = () => {
        const layout = ctx.get('layout')
        if (layout?.selectPanel) layout.selectPanel(PANEL_ID)
      }

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 20,
            locale: NS,
            label: () => t('page.title'),
            inject: () => ({ store, t }),
          },
          IosSimIcon,
        ),
      )

      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: PANEL_ID,
            locale: NS,
            inject: () => ({ store, t, layoutSelect }),
          },
          IosSimPage,
        ),
      )

      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'ios-simulator-toast',
            order: 30,
            locale: NS,
            inject: () => ({ store, t, layoutSelect }),
          },
          IosSimToast,
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply,
    }
  },
})

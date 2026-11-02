/**
 * iOS Simulator Lab — Host half.
 *
 * Owns the per-session simulator bindings, the background verification jobs
 * (`xcodebuild` / `simctl`), the small JSON API the sidebar panel polls, and the
 * agent-facing `ios_simulator` tool. Everything runs through absolute macOS
 * binaries so a GUI-launched Harness with a minimal PATH still works.
 */
import { spawn } from 'node:child_process'
import { createWriteStream, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { randomUUID } from 'node:crypto'

const XCRUN = '/usr/bin/xcrun'
const XCODEBUILD = '/usr/bin/xcodebuild'
const OSASCRIPT = '/usr/bin/osascript'
const OPEN = '/usr/bin/open'
const PLUTIL = '/usr/bin/plutil'
const ZSH = '/bin/zsh'

const ROUTE = '/dsh-ios-sim'
const STATE_VERSION = 1

const ACTIVE = new Set(['queued', 'running'])
const MAX_JOBS = 60
const MAX_TAIL_LINES = 400

/** @param {number} ms */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** @param {string} runtimeKey */
function runtimeLabel(runtimeKey) {
  const short = String(runtimeKey).split('.').pop() ?? String(runtimeKey)
  const match = /^(.*)-(\d+)-(\d+)$/.exec(short)
  if (match) return `${match[1]} ${match[2]}.${match[3]}`
  return short.replaceAll('-', ' ')
}

/** `com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro` → `iPhone 15 Pro`. */
function modelName(deviceType) {
  if (!deviceType) return null
  const tail = String(deviceType).split('.').pop() ?? ''
  const name = tail.replaceAll('-', ' ').replace(/^iPhone\s+/, 'iPhone ').replace(/^iPad\s+/, 'iPad ').trim()
  return name || null
}

/** @param {string} text */
function appleScriptString(text) {
  return `"${String(text)
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')}"`
}

/** @param {string[]} args */
function commandLine(command, args) {
  return [command, ...args].map((part) => (/[^\w./:@=+-]/.test(part) ? `'${part.replaceAll("'", `'\\''`)}'` : part)).join(' ')
}

/**
 * Run a short-lived command and collect its output (used for discovery calls).
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd?: string, env?: Record<string, string>, timeoutMs?: number, signal?: AbortSignal }} [options]
 */
function execCollect(command, args, options = {}) {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (error) {
      resolve({ code: -1, signal: null, stdout: '', stderr: String(error), error })
      return
    }
    let stdout = ''
    let stderr = ''
    let settled = false
    const finish = (code, signal, error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
      resolve({ code, signal, stdout, stderr, error })
    }
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {}
      finish(-1, null, new Error(`timeout after ${options.timeoutMs ?? 60000}ms`))
    }, options.timeoutMs ?? 60000)
    const onAbort = () => {
      try {
        child.kill('SIGKILL')
      } catch {}
      finish(-1, null, new Error('aborted'))
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
      if (stdout.length > 4_000_000) stdout = stdout.slice(-2_000_000)
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
      if (stderr.length > 4_000_000) stderr = stderr.slice(-2_000_000)
    })
    child.on('error', (error) => finish(-1, null, error))
    child.on('close', (code, signal) => finish(code ?? -1, signal, undefined))
  })
}

/** @param {unknown} error */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

export function apply(ctx) {
  const profileDir = process.env.DSH_PROFILE_DIR || join(homedir(), '.dsh')
  const dataDir = join(profileDir, 'data', 'ios-simulator')
  const runsDir = join(dataDir, 'runs')
  const shotsDir = join(dataDir, 'shots')
  const derivedRoot = join(dataDir, 'derived')
  for (const dir of [dataDir, runsDir, shotsDir, derivedRoot]) mkdirSync(dir, { recursive: true })

  const stateFile = join(dataDir, 'state.json')
  const historyFile = join(dataDir, 'history.json')

  /** @type {Map<string, { udid: string, name: string, runtime: string, at: number, auto: boolean }>} */
  const assignments = new Map()
  /** @type {Map<string, { mode?: string, scheme?: string, command?: string }>} */
  const prefs = new Map()
  /** @type {Record<string, any>} */
  const settings = { autoAssign: true, notify: true, autoOpen: false }
  /** Panel UI state, persisted so switching panels or restarting does not reset it. */
  const ui = {
    onlyAssigned: false,
    showAll: false,
    collapsed: [],
    openLogs: [],
    hiddenShots: [],
    updatedAt: 0,
  }

  /** @type {Array<any>} */
  let jobs = []
  /** @type {Map<string, any>} */
  const live = new Map()
  let persistTimer = null

  // ---------------------------------------------------------------- persistence

  function loadState() {
    try {
      const parsed = JSON.parse(readFileSync(stateFile, 'utf8'))
      if (parsed?.version !== STATE_VERSION) return
      for (const [sessionId, value] of Object.entries(parsed.assignments ?? {})) {
        if (value && typeof value.udid === 'string') assignments.set(sessionId, value)
      }
      for (const [sessionId, value] of Object.entries(parsed.prefs ?? {})) prefs.set(sessionId, value)
      Object.assign(settings, parsed.settings ?? {})
      if (parsed.ui && typeof parsed.ui === 'object') {
        if (typeof parsed.ui.onlyAssigned === 'boolean') ui.onlyAssigned = parsed.ui.onlyAssigned
        if (typeof parsed.ui.showAll === 'boolean') ui.showAll = parsed.ui.showAll
        if (typeof parsed.ui.updatedAt === 'number') ui.updatedAt = parsed.ui.updatedAt
        for (const key of ['collapsed', 'openLogs', 'hiddenShots']) {
          if (Array.isArray(parsed.ui[key])) {
            ui[key] = parsed.ui[key].filter((value) => typeof value === 'string').slice(-200)
          }
        }
      }
    } catch {}
    try {
      const parsed = JSON.parse(readFileSync(historyFile, 'utf8'))
      if (Array.isArray(parsed?.jobs)) {
        jobs = parsed.jobs.slice(0, MAX_JOBS).map((job) => ({
          ...job,
          status: ACTIVE.has(job.status) ? 'interrupted' : job.status,
          tail: '',
          endedAt: job.endedAt ?? job.startedAt ?? Date.now(),
        }))
      }
    } catch {}
  }

  function persistNow() {
    try {
      const body = {
        version: STATE_VERSION,
        assignments: Object.fromEntries(assignments),
        prefs: Object.fromEntries(prefs),
        settings,
        ui,
      }
      const tmp = `${stateFile}.tmp`
      writeFileSync(tmp, JSON.stringify(body, null, 2))
      renameSync(tmp, stateFile)
    } catch (error) {
      ctx.logger?.warn?.(`[ios-simulator] cannot persist assignments: ${errorMessage(error)}`)
    }
  }

  function persistSoon() {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistTimer = null
      persistNow()
    }, 150)
  }

  function persistHistory() {
    try {
      const body = {
        version: STATE_VERSION,
        jobs: jobs.slice(0, MAX_JOBS).map((job) => {
          const { stream, child, ...plain } = job
          return { ...plain, tail: '' }
        }),
      }
      const tmp = `${historyFile}.tmp`
      writeFileSync(tmp, JSON.stringify(body, null, 2))
      renameSync(tmp, historyFile)
    } catch {}
  }

  loadState()

  // ---------------------------------------------------------------- devices

  /** @type {{ at: number, value: any[] } | null} */
  let devicesCache = null

  async function listDevices(force = false) {
    if (!force && devicesCache && Date.now() - devicesCache.at < 5000) return devicesCache.value
    const result = await execCollect(XCRUN, ['simctl', 'list', 'devices', 'available', '--json'], { timeoutMs: 20000 })
    if (result.code !== 0) {
      throw new Error(`simctl list failed: ${result.stderr.trim() || `exit ${result.code}`}`)
    }
    let parsed
    try {
      parsed = JSON.parse(result.stdout)
    } catch {
      throw new Error('simctl returned unreadable JSON')
    }
    const devices = []
    for (const [runtimeKey, list] of Object.entries(parsed.devices ?? {})) {
      for (const device of list ?? []) {
        if (!device?.isAvailable) continue
        devices.push({
          udid: device.udid,
          name: device.name,
          runtime: runtimeLabel(runtimeKey),
          runtimeKey,
          state: device.state,
          booted: device.state === 'Booted',
          iphone: /iphone/i.test(device.name),
          model: modelName(device.deviceTypeIdentifier) ?? device.name,
          deviceType: device.deviceTypeIdentifier ?? null,
        })
      }
    }
    devices.sort((a, b) => {
      if (a.iphone !== b.iphone) return a.iphone ? -1 : 1
      if (a.runtimeKey !== b.runtimeKey) return a.runtimeKey < b.runtimeKey ? 1 : -1
      return a.name.localeCompare(b.name)
    })
    devicesCache = { at: Date.now(), value: devices }
    return devices
  }

  /** @param {string} udid */
  async function findDevice(udid) {
    const devices = await listDevices()
    return devices.find((device) => device.udid === udid)
  }

  // ---------------------------------------------------------------- sessions

  /** @type {{ at: number, value: any[] } | null} */
  let sessionsCache = null
  /** @type {Map<string, { at: number, title: string }>} */
  const titleCache = new Map()

  async function listSessions() {
    if (sessionsCache && Date.now() - sessionsCache.at < 4000) return sessionsCache.value
    const query = ctx.get('sessionQuery')
    if (!query?.listSessions) return []
    let records
    try {
      records = await query.listSessions()
    } catch (error) {
      ctx.logger?.warn?.(`[ios-simulator] cannot list sessions: ${errorMessage(error)}`)
      return []
    }
    const filtered = records
      .filter((record) => record?.header?.id && record.header.origin !== 'subagent')
      .sort((a, b) => (b.header.createdAt ?? 0) - (a.header.createdAt ?? 0))
      .slice(0, 60)

    const stale = filtered.filter((record) => {
      const cached = titleCache.get(record.header.id)
      return !cached || Date.now() - cached.at > 30000
    })
    if (stale.length && query.readTitleSnapshots) {
      try {
        const observations = await query.readTitleSnapshots(stale.map((record) => record.header.id))
        for (const observation of observations) {
          if (observation?.status !== 'fulfilled') continue
          const title = observation.value?.title?.title
          if (typeof title === 'string' && title.trim()) {
            titleCache.set(observation.sessionId, { at: Date.now(), title: title.trim() })
          }
        }
      } catch {}
      for (const record of stale) {
        if (!titleCache.has(record.header.id)) titleCache.set(record.header.id, { at: Date.now(), title: '' })
      }
    }

    const value = filtered.map((record) => {
      const id = String(record.header.id)
      const cwd = record.header.cwd ?? ''
      const title = titleCache.get(id)?.title || (cwd ? basename(cwd) : `会话 ${id.slice(0, 6)}`)
      return { id, title, cwd, createdAt: record.header.createdAt ?? 0, live: Boolean(record.live) }
    })
    sessionsCache = { at: Date.now(), value }
    return value
  }

  /** @param {string} sessionId */
  async function findSession(sessionId) {
    const sessions = await listSessions()
    return sessions.find((session) => session.id === sessionId)
  }

  // ---------------------------------------------------------------- jobs

  function ringPush(job, line) {
    job.tail += `${line}\n`
    if (job.tail.length > 24000) job.tail = job.tail.slice(-18000)
    job.lines += 1
    if (job.lines > MAX_TAIL_LINES) {
      const cut = job.tail.indexOf('\n')
      if (cut !== -1 && job.tail.length > 16000) job.tail = job.tail.slice(cut + 1)
    }
  }

  /** `-[Module.Class testName]` → `Module.Class.testName` for readable reminders. */
  function normalizeTestName(raw) {
    const legacy = /^-\[(.+?)\s+([^\s\]]+)\]$/.exec(raw)
    if (legacy) return `${legacy[1]}.${legacy[2]}`
    return raw.replace(/\(\)$/, '')
  }

  /** Fold xcodebuild output into per-job test statistics as it streams. */
  function noteOutput(job, text) {
    if (!job.stats) job.stats = { passed: 0, failed: 0, failedTests: [], lastError: null }
    const test = /^test case '(.+?)' (passed|failed)\b/i.exec(text.trim())
    if (test) {
      if (test[2].toLowerCase() === 'passed') {
        job.stats.passed += 1
      } else {
        job.stats.failed += 1
        const name = normalizeTestName(test[1]).slice(0, 100)
        if (job.stats.failedTests.length < 5 && !job.stats.failedTests.includes(name)) {
          job.stats.failedTests.push(name)
        }
      }
    }
    const errorMatch = /\berror:\s*(.+)$/.exec(text)
    if (errorMatch && !/\bwarning:/i.test(text)) {
      job.stats.lastError = errorMatch[1].trim().slice(0, 240)
    }
  }

  function logLine(job, line) {
    const stamp = new Date().toTimeString().slice(0, 8)
    const text = `${line}`
    ringPush(job, `[${stamp}] ${text}`)
    noteOutput(job, text)
    try {
      job.stream?.write(`${text}\n`)
    } catch {}
  }

  function isActive(job) {
    return Boolean(job) && ACTIVE.has(job.status)
  }

  /** @param {string} sessionId */
  function activeJobForSession(sessionId) {
    return jobs.find((job) => job.sessionId === sessionId && isActive(job))
  }

  /** @param {string} udid */
  function activeJobForDevice(udid) {
    return jobs.find((job) => job.deviceUdid === udid && isActive(job))
  }

  /** @param {any} job */
  function publicJob(job) {
    if (!job) return null
    const now = job.endedAt ?? Date.now()
    return {
      id: job.id,
      sessionId: job.sessionId,
      sessionTitle: job.sessionTitle,
      deviceUdid: job.deviceUdid,
      deviceName: job.deviceName,
      deviceRuntime: job.deviceRuntime,
      deviceModel: job.deviceModel ?? job.deviceName,
      deviceType: job.deviceType ?? null,
      workspace: job.workspaceDir ?? job.cwd ?? '',
      workspaceName: job.workspaceName ?? '',
      mode: job.mode,
      scheme: job.scheme ?? null,
      status: job.status,
      step: job.step,
      startedAt: job.startedAt,
      endedAt: job.endedAt,
      durationMs: job.startedAt ? Math.max(0, now - job.startedAt) : 0,
      exitCode: job.exitCode ?? null,
      summary: job.summary ?? null,
      detail: job.detail ?? null,
      stats: job.stats ?? null,
      notice: job.notice ?? null,
      error: job.error ?? null,
      shot: job.shot ? `${ROUTE}/shot/${job.shot}?v=${job.shotAt ?? job.startedAt}` : null,
      logUrl: `${ROUTE}/log/${job.id}`,
      tail: job.tail ?? '',
    }
  }

  function recentJobsForSession(sessionId) {
    return jobs
      .filter((job) => job.sessionId === sessionId)
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0))
  }

  // ---------------------------------------------------------------- device binding

  /** @param {string} sessionId */
  function assignmentOf(sessionId) {
    return assignments.get(sessionId) ?? null
  }

  /**
   * Pick a device that no other session owns and no job is using. Prefers a
   * shut-down iPhone on the newest runtime so the user's open simulators stay
   * untouched.
   */
  async function autoAssignDevice(sessionId) {
    const devices = await listDevices()
    const taken = new Set([...assignments.entries()].filter(([id]) => id !== sessionId).map(([, value]) => value.udid))
    const candidates = devices.filter((device) => {
      if (taken.has(device.udid)) return false
      if (activeJobForDevice(device.udid)) return false
      return true
    })
    const iphones = candidates.filter((device) => device.iphone)
    const pool = iphones.length ? iphones : candidates
    if (!pool.length) return null
    const off = pool.filter((device) => !device.booted)
    const chosen = (off.length ? off : pool)[0]
    const binding = {
      udid: chosen.udid,
      name: chosen.name,
      model: chosen.model,
      deviceType: chosen.deviceType,
      runtime: chosen.runtime,
      at: Date.now(),
      auto: true,
    }
    assignments.set(sessionId, binding)
    persistSoon()
    return binding
  }

  /**
   * Resolve (or create) the session's device. `preferredUdid` is an explicit
   * user choice from the panel or the tool.
   * @param {string} sessionId
   * @param {string | undefined} preferredUdid
   */
  async function ensureAssignment(sessionId, preferredUdid) {
    const devices = await listDevices()
    if (preferredUdid) {
      const device = devices.find((item) => item.udid === preferredUdid)
      if (!device) return { error: { code: 'device_not_found', message: `找不到模拟器 ${preferredUdid}` } }
      const owner = [...assignments.entries()].find(([id, value]) => id !== sessionId && value.udid === preferredUdid)
      if (owner) {
        return { error: { code: 'device_bound', message: `该模拟器已被会话 ${owner[0]} 占用` } }
      }
      const binding = {
        udid: device.udid,
        name: device.name,
        model: device.model,
        deviceType: device.deviceType,
        runtime: device.runtime,
        at: Date.now(),
        auto: false,
      }
      assignments.set(sessionId, binding)
      persistSoon()
      return { binding, device }
    }
    const existing = assignmentOf(sessionId)
    if (existing) {
      const device = devices.find((item) => item.udid === existing.udid)
      if (!device) {
        return {
          error: {
            code: 'device_unavailable',
            message: `绑定的机型「${existing.model ?? existing.name}」不可用；为避免换机，本次没有执行。请重新选择设备。`,
          },
        }
      }
      if (
        (existing.deviceType && device.deviceType && existing.deviceType !== device.deviceType) ||
        (!existing.deviceType && existing.model && device.name !== existing.model)
      ) {
        return {
          error: {
            code: 'device_mismatch',
            message: `绑定的机型「${existing.model ?? existing.name}」与当前设备「${device.model}」不一致；已中止，未在其他机型上执行。`,
          },
        }
      }
      const binding = {
        ...existing,
        name: device.name,
        model: device.model,
        deviceType: device.deviceType,
        runtime: device.runtime,
      }
      assignments.set(sessionId, binding)
      return { binding, device }
    }
    if (!settings.autoAssign) {
      return { error: { code: 'no_device', message: '当前会话还没有绑定模拟器，请先在面板里选择一台' } }
    }
    const binding = await autoAssignDevice(sessionId)
    if (!binding) {
      return { error: { code: 'no_device', message: '没有空闲的模拟器可用，请先在面板里释放一台设备' } }
    }
    const device = devices.find((item) => item.udid === binding.udid)
    return { binding, device }
  }

  // ---------------------------------------------------------------- running commands

  /**
   * Spawn one command for a job, stream stdout/stderr into the job log, and
   * resolve with its exit status. The child is tracked so `stop` can kill its
   * whole process group.
   */
  function runStep(job, command, args, options = {}) {
    return new Promise((resolve) => {
      logLine(job, `$ ${commandLine(command, args)}`)
      if (options.cwd) logLine(job, `  cwd: ${options.cwd}`)
      let child
      try {
        child = spawn(command, args, {
          cwd: options.cwd,
          env: { ...process.env, ...(options.env ?? {}) },
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      } catch (error) {
        logLine(job, `! ${errorMessage(error)}`)
        resolve({ code: -1, signal: null, error })
        return
      }
      job.child = child
      const capture = (stream) => {
        let buffer = ''
        stream.on('data', (chunk) => {
          buffer += chunk.toString()
          let index
          while ((index = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, index).replace(/\r$/, '')
            buffer = buffer.slice(index + 1)
            if (line.length) logLine(job, line)
          }
          if (buffer.length > 4000) {
            logLine(job, buffer)
            buffer = ''
          }
        })
        stream.on('end', () => {
          if (buffer.trim()) logLine(job, buffer)
          buffer = ''
        })
      }
      capture(child.stdout)
      capture(child.stderr)
      let settled = false
      const finish = (code, signal, error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        job.child = null
        if (error) logLine(job, `! ${errorMessage(error)}`)
        resolve({ code, signal, error })
      }
      const timer = setTimeout(() => {
        logLine(job, `! 超时（${Math.round((options.timeoutMs ?? 1800000) / 1000)}s），终止进程`)
        try {
          if (child.pid) process.kill(-child.pid, 'SIGKILL')
        } catch {}
        job.child = null
        finish(-1, 'SIGKILL', new Error('timeout'))
      }, options.timeoutMs ?? 1800000)
      child.on('error', (error) => finish(-1, null, error))
      child.on('close', (code, signal) => finish(code ?? -1, signal, undefined))
    })
  }

  function killJob(job) {
    if (!job) return false
    const child = job.child
    if (!child?.pid) return false
    try {
      process.kill(-child.pid, 'SIGINT')
    } catch {
      try {
        child.kill('SIGINT')
      } catch {}
    }
    job.stopRequested = true
    logLine(job, '· 收到停止请求')
    setTimeout(() => {
      if (job.child?.pid) {
        try {
          process.kill(-job.child.pid, 'SIGKILL')
        } catch {}
      }
    }, 4000)
    return true
  }

  // ---------------------------------------------------------------- job pipeline

  /**
   * Locate the Xcode project for a job's session directory.
   * @param {any} job
   */
  async function resolveProject(job) {
    if (job.workspace) return { kind: 'workspace', path: job.workspace }
    if (job.project) return { kind: 'project', path: job.project }
    const entries = await readdir(job.cwd, { withFileTypes: true }).catch(() => [])
    const workspace = entries.find((entry) => entry.isDirectory() && entry.name.endsWith('.xcworkspace'))
    if (workspace) return { kind: 'workspace', path: join(job.cwd, workspace.name) }
    const project = entries.find((entry) => entry.isDirectory() && entry.name.endsWith('.xcodeproj'))
    if (project) return { kind: 'project', path: join(job.cwd, project.name) }
    return null
  }

  /** @param {any} job @param {{kind: string, path: string}} project */
  async function resolveScheme(job, project) {
    if (job.scheme) return job.scheme
    const remembered = prefs.get(job.sessionId)?.scheme
    if (remembered) return remembered
    const flag = project.kind === 'workspace' ? '-workspace' : '-project'
    const result = await execCollect(XCODEBUILD, ['-list', '-json', flag, project.path], {
      cwd: job.cwd,
      timeoutMs: 120000,
    })
    if (result.code !== 0) {
      throw new Error(`无法读取 scheme 列表：${(result.stderr || result.stdout).trim().slice(0, 400) || `exit ${result.code}`}`)
    }
    let schemes = []
    try {
      const parsed = JSON.parse(result.stdout)
      schemes = parsed?.workspace?.schemes ?? parsed?.project?.schemes ?? []
    } catch {}
    if (!schemes.length) throw new Error('工程里没有可用的 scheme')
    const base = basename(project.path).replace(/\.(xcworkspace|xcodeproj)$/, '')
    return schemes.find((scheme) => scheme === base) ?? schemes[0]
  }

  /** @param {string} derived @param {string} scheme */
  async function findBuiltApp(derived, scheme) {
    const products = join(derived, 'Build', 'Products', 'Debug-iphonesimulator')
    const entries = await readdir(products, { withFileTypes: true }).catch(() => [])
    const apps = entries.filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
    if (!apps.length) return null
    const exact = apps.find((entry) => entry.name === `${scheme}.app`)
    return join(products, (exact ?? apps[0]).name)
  }

  /** @param {string} app */
  async function bundleIdentifier(app) {
    const result = await execCollect(PLUTIL, ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', join(app, 'Info.plist')], {
      timeoutMs: 15000,
    })
    return result.code === 0 ? result.stdout.trim() : ''
  }

  /** @param {string} udid @param {string} shotPath */
  async function captureScreenshot(job, udid, shotPath) {
    const result = await runStep(job, XCRUN, ['simctl', 'io', udid, 'screenshot', shotPath], { timeoutMs: 30000 })
    return result.code === 0
  }

  function summarize(job, mode) {
    const text = job.tail
    if (/\*\* TEST SUCCEEDED \*\*/.test(text)) return 'TEST SUCCEEDED'
    if (/\*\* TEST FAILED \*\*/.test(text)) return 'TEST FAILED'
    if (/\*\* BUILD SUCCEEDED \*\*/.test(text)) return 'BUILD SUCCEEDED'
    if (/\*\* BUILD FAILED \*\*/.test(text)) return 'BUILD FAILED'
    if (mode === 'test' && /Test Suite .* (passed|failed)/.test(text)) {
      return text.includes('failed') ? 'Tests reported failures' : 'Tests passed'
    }
    return null
  }

  function modeLabel(mode) {
    return { install: '安装并启动', test: 'UI 测试', build: '构建', command: '自定义命令' }[mode] ?? mode
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.round((ms || 0) / 1000))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60
    if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  /** One-line result detail shared by the panel, the tool and notifications. */
  function describeResult(job) {
    const stats = job.stats
    const parts = []
    if (stats?.failed) {
      parts.push(
        `${stats.failed} 个测试失败` +
          (stats.failedTests.length ? `（${stats.failedTests.slice(0, 2).join('、')}）` : ''),
      )
    } else if (stats?.passed) {
      parts.push(`${stats.passed} 个测试通过`)
    }
    if (job.error) parts.push(job.error)
    else if (stats?.lastError) parts.push(stats.lastError)
    return parts.join(' · ')
  }

  async function notify(job) {
    const ok = job.status === 'passed'
    const stopped = job.status === 'stopped'
    const title = ok ? '✅ 模拟器验证通过' : stopped ? '⏹ 模拟器验证已停止' : '❌ 模拟器验证失败'
    const subtitle = `${job.workspaceName || '—'} · ${job.deviceModel} · ${job.deviceRuntime}${job.scheme ? ` · ${job.scheme}` : ''}`
    const head = `会话「${job.sessionTitle}」· ${modeLabel(job.mode)} · 用时 ${formatDuration(job.endedAt - job.startedAt)}`
    const summaryPart = job.mode === 'command' ? null : job.summary
    const result = [summaryPart, job.detail || job.error].filter(Boolean).join(' · ') ||
      (ok ? '验证完成，可以打开模拟器验收' : '请打开验证台查看日志')
    const body = `${result}\n${head}`
    job.notice = { title, subtitle, body }
    if (!settings.notify) return
    const script = `display notification ${appleScriptString(body)} with title ${appleScriptString(title)} subtitle ${appleScriptString(subtitle)} sound name ${ok ? '"Glass"' : stopped ? '"Pop"' : '"Basso"'}`
    await execCollect(OSASCRIPT, ['-e', script], { timeoutMs: 15000 }).catch(() => {})
  }

  /** @param {any} job */
  async function finishJob(job, status, detail) {
    if (!ACTIVE.has(job.status) && job.status !== 'queued') return
    if (detail?.exitCode !== undefined) job.exitCode = detail.exitCode
    if (detail?.error) job.error = detail.error
    if (!job.summary) {
      job.summary =
        summarize(job, job.mode) ??
        (job.mode === 'command' ? (job.exitCode === 0 ? 'COMMAND SUCCEEDED' : 'COMMAND FAILED') : null)
    }
    // A parsed failing test outranks a zero exit code: the reminder must never
    // report success while the output lists failing test cases.
    if (status === 'passed' && job.stats?.failed) {
      status = 'failed'
      job.summary = job.mode === 'test' ? 'TEST FAILED' : 'COMMAND FAILED'
    }
    job.status = status
    job.endedAt = Date.now()
    job.step = 'done'
    if (!job.detail) job.detail = describeResult(job)
    logLine(job, `· 结束：${status}${job.exitCode !== null ? ` (exit ${job.exitCode})` : ''}`)
    try {
      job.stream?.end()
    } catch {}
    job.stream = null
    live.delete(job.id)
    await notify(job)
    persistHistory()
    if (status === 'passed' && settings.autoOpen && job.deviceUdid) {
      await openSimulator(job.deviceUdid).catch(() => {})
    }
    sessionsCache = null
  }

  /** @param {any} job */
  async function executeJob(job) {
    job.status = 'running'
    try {
      // Preflight: the exact device (UDID + model) is verified before anything
      // is built or booted. A missing or substituted model aborts the job.
      job.step = 'verify'
      const target = (await listDevices(true)).find((device) => device.udid === job.deviceUdid)
      if (!target) {
        throw new Error(`目标模拟器已不可用：${job.deviceName}（${job.deviceUdid}）；已中止，未在其他设备上执行`)
      }
      if (job.deviceType && target.deviceType && target.deviceType !== job.deviceType) {
        throw new Error(
          `机型校验失败：任务锁定「${job.deviceModel}」，当前设备为「${target.model}」；已中止，未在其他机型上执行`,
        )
      }
      if (!job.deviceType && job.deviceModel && target.model !== job.deviceModel) {
        throw new Error(
          `机型校验失败：任务锁定「${job.deviceModel}」，当前设备为「${target.model}」；已中止，未在其他机型上执行`,
        )
      }
      job.deviceName = target.name
      job.deviceModel = target.model
      job.deviceType = target.deviceType
      job.deviceRuntime = target.runtime
      logLine(job, `· 机型锁定：${target.model}（${target.name}）· ${target.runtime} · ${target.udid}`)

      job.step = job.mode === 'build' ? 'build' : 'boot'
      if (job.mode !== 'build') {
        logLine(job, `· 启动模拟器 ${job.deviceName} (${job.deviceUdid})`)
        await runStep(job, XCRUN, ['simctl', 'boot', job.deviceUdid], { timeoutMs: 120000 })
        const booted = await runStep(job, XCRUN, ['simctl', 'bootstatus', job.deviceUdid, '-b'], { timeoutMs: 240000 })
        if (booted.code !== 0) throw new Error('模拟器启动超时')
        const afterBoot = (await listDevices(true)).find((device) => device.udid === job.deviceUdid)
        if (!afterBoot || afterBoot.state !== 'Booted') {
          throw new Error(`目标模拟器未进入运行状态：${job.deviceName}`)
        }
      }

      if (job.mode === 'command') {
        job.step = 'command'
        const env = {
          DSH_SIM_UDID: job.deviceUdid,
          DSH_SIM_NAME: job.deviceName,
          DSH_SIM_RUNTIME: job.deviceRuntime ?? '',
          DSH_SIM_SESSION: job.sessionId,
        }
        const result = await runStep(job, ZSH, ['-lc', job.command], {
          cwd: job.cwd,
          env,
          timeoutMs: 45 * 60 * 1000,
        })
        job.exitCode = result.code
        if (job.stopRequested) return finishJob(job, 'stopped')
        job.step = 'screenshot'
        const shotPath = join(shotsDir, `job-${job.id}.png`)
        const shot = await captureScreenshot(job, job.deviceUdid, shotPath)
        if (shot) {
          job.shot = `job-${job.id}.png`
          job.shotAt = Date.now()
        } else {
          try {
            unlinkSync(shotPath)
          } catch {}
        }
        return finishJob(job, result.code === 0 ? 'passed' : 'failed', { exitCode: result.code })
      }

      const project = await resolveProject(job)
      if (!project) {
        throw new Error(`会话目录里没有找到 Xcode 工程：${job.cwd}（可在面板或工具里指定 project/workspace 路径）`)
      }
      const scheme = await resolveScheme(job, project)
      job.scheme = scheme
      const derived = join(derivedRoot, job.deviceUdid.slice(0, 8))

      const args = [
        project.kind === 'workspace' ? '-workspace' : '-project',
        project.path,
        '-scheme',
        scheme,
        '-configuration',
        'Debug',
        '-destination',
        `platform=iOS Simulator,id=${job.deviceUdid}`,
        '-destination-timeout',
        '120',
        '-parallel-testing-enabled',
        'NO',
        '-derivedDataPath',
        derived,
      ]
      if (job.mode === 'test' && job.onlyTesting) args.push(`-only-testing:${job.onlyTesting}`)

      job.step = job.mode === 'test' ? 'test' : 'build'
      args.push(job.mode === 'test' ? 'test' : 'build')
      const build = await runStep(job, XCODEBUILD, args, { cwd: job.cwd, timeoutMs: 45 * 60 * 1000 })
      job.exitCode = build.code
      if (job.stopRequested) return finishJob(job, 'stopped')
      if (/Using the first of multiple matching destinations/i.test(job.tail)) {
        throw new Error('xcodebuild 在多个匹配目标中选了第一个，未保证指定机型；已判为失败')
      }
      if (build.code !== 0) {
        job.summary = summarize(job, job.mode) ?? (job.mode === 'test' ? 'TEST FAILED' : 'BUILD FAILED')
        return finishJob(job, 'failed', { exitCode: build.code })
      }

      let app = null
      if (job.mode === 'install') {
        app = await findBuiltApp(derived, scheme)
        if (!app) throw new Error('构建成功但找不到 .app 产物')
        job.step = 'install'
        const install = await runStep(job, XCRUN, ['simctl', 'install', job.deviceUdid, app], { timeoutMs: 180000 })
        if (install.code !== 0) throw new Error('安装到模拟器失败')
        const bundleId = await bundleIdentifier(app)
        if (bundleId) {
          job.step = 'launch'
          logLine(job, `· 启动 ${bundleId}`)
          const launched = await runStep(job, XCRUN, ['simctl', 'launch', job.deviceUdid, bundleId], { timeoutMs: 60000 })
          job.detail = launched.code === 0 ? `已安装并启动 ${bundleId}` : `已安装 ${bundleId}（启动失败）`
        } else {
          job.detail = '已安装到模拟器'
        }
      }

      if (job.mode !== 'build') {
        await sleep(job.mode === 'install' ? 1600 : 600)
        job.step = 'screenshot'
        const shotPath = join(shotsDir, `job-${job.id}.png`)
        const shot = await captureScreenshot(job, job.deviceUdid, shotPath)
        if (shot) {
          job.shot = `job-${job.id}.png`
          job.shotAt = Date.now()
        } else {
          try {
            unlinkSync(shotPath)
          } catch {}
        }
      }

      job.summary = summarize(job, job.mode) ?? (job.mode === 'test' ? 'TEST SUCCEEDED' : 'BUILD SUCCEEDED')
      return finishJob(job, 'passed', { exitCode: 0 })
    } catch (error) {
      if (job.stopRequested) return finishJob(job, 'stopped')
      job.step = 'done'
      return finishJob(job, 'failed', { error: errorMessage(error) })
    }
  }

  /** @param {string} udid */
  async function openSimulator(udid) {
    await execCollect(XCRUN, ['simctl', 'boot', udid], { timeoutMs: 120000 })
    await execCollect(OPEN, ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', udid], { timeoutMs: 20000 })
  }

  // ---------------------------------------------------------------- public operations

  /** @param {string} sessionId */
  async function sessionsWithState() {
    const [devices, sessions] = await Promise.all([listDevices(), listSessions()])
    const deviceById = new Map(devices.map((device) => [device.udid, device]))
    const result = sessions.map((session) => {
      const binding = assignmentOf(session.id)
      const bindingDevice = binding ? deviceById.get(binding.udid) : undefined
      const active = activeJobForSession(session.id)
      const latest = recentJobsForSession(session.id)[0]
      const remembered = prefs.get(session.id) ?? {}
      return {
        ...session,
        workspace: session.cwd || '',
        workspaceName: session.cwd ? basename(session.cwd) : '未设置工作区',
        assignment: binding
          ? {
              udid: binding.udid,
              name: binding.name,
              model: binding.model ?? binding.name,
              runtime: binding.runtime,
              auto: Boolean(binding.auto),
              stale: !bindingDevice,
              state: bindingDevice?.state ?? 'Unavailable',
            }
          : null,
        activeJob: active ? publicJob(active) : null,
        lastJob: !active && latest ? publicJob(latest) : null,
        runOptions: {
          mode: remembered.mode ?? latest?.mode ?? 'install',
          scheme: remembered.scheme ?? latest?.scheme ?? '',
          command: remembered.command ?? '',
        },
      }
    })
    return { devices, sessions: result }
  }

  async function snapshot() {
    const { devices, sessions } = await sessionsWithState()
    const boundBy = new Map()
    for (const [sessionId, binding] of assignments) {
      const session = sessions.find((item) => item.id === sessionId)
      boundBy.set(binding.udid, { sessionId, title: session?.title ?? sessionId.slice(0, 6) })
    }
    return {
      now: Date.now(),
      settings: { ...settings },
      devices: devices.map((device) => ({
        ...device,
        boundTo: boundBy.get(device.udid) ?? null,
        busy: Boolean(activeJobForDevice(device.udid)),
      })),
      sessions,
      jobs: jobs.slice(0, 20).map(publicJob),
      ui: {
        ...ui,
        collapsed: [...ui.collapsed],
        openLogs: [...ui.openLogs],
        hiddenShots: [...ui.hiddenShots],
      },
      version: STATE_VERSION,
    }
  }

  /** @param {string} sessionId @param {string | null} udid */
  async function assignSession(sessionId, udid) {
    if (activeJobForSession(sessionId)) {
      return { ok: false, error: { code: 'session_busy', message: '该会话正在验证，请先停止或等待完成' } }
    }
    if (udid === null) {
      assignments.delete(sessionId)
      persistSoon()
      return { ok: true, message: '已解除模拟器绑定' }
    }
    const device = await findDevice(udid)
    if (!device) return { ok: false, error: { code: 'device_not_found', message: '找不到该模拟器' } }
    const owner = [...assignments.entries()].find(([id, value]) => id !== sessionId && value.udid === udid)
    if (owner) {
      const sessions = await listSessions()
      const title = sessions.find((session) => session.id === owner[0])?.title ?? owner[0]
      return { ok: false, error: { code: 'device_bound', message: `该模拟器正在给会话「${title}」使用` } }
    }
    assignments.set(sessionId, {
      udid: device.udid,
      name: device.name,
      model: device.model,
      deviceType: device.deviceType,
      runtime: device.runtime,
      at: Date.now(),
      auto: false,
    })
    persistSoon()
    return { ok: true, message: `已锁定机型 ${device.name}（${device.runtime}）` }
  }

  /**
   * @param {string} sessionId
   * @param {{ mode?: string, scheme?: string, project?: string, workspace?: string, command?: string, deviceUdid?: string, onlyTesting?: string }} options
   */
  async function startRun(sessionId, options = {}) {
    const session = await findSession(sessionId)
    if (!session) return { ok: false, error: { code: 'session_not_found', message: `找不到会话 ${sessionId}` } }
    const running = activeJobForSession(sessionId)
    if (running) return { ok: false, error: { code: 'session_busy', message: '该会话已有验证在运行', job: publicJob(running) } }

    const mode = ['build', 'install', 'test', 'command'].includes(options.mode) ? options.mode : 'install'
    if (mode === 'command' && !options.command?.trim()) {
      return { ok: false, error: { code: 'command_required', message: '自定义模式需要一条命令' } }
    }

    const resolved = await ensureAssignment(sessionId, options.deviceUdid)
    if (resolved.error) return { ok: false, error: resolved.error }
    const { binding, device } = resolved
    const deviceBusy = activeJobForDevice(binding.udid)
    if (deviceBusy) {
      return { ok: false, error: { code: 'device_busy', message: `${binding.name} 正在为另一个会话验证` } }
    }

    const jobId = randomUUID().slice(0, 8)
    const job = {
      id: jobId,
      sessionId,
      sessionTitle: session.title,
      cwd: session.cwd || ctx.get('workingDirectory')?.defaultDirectory || process.cwd(),
      workspaceDir: session.cwd || '',
      workspaceName: session.cwd ? basename(session.cwd) : '未设置工作区',
      deviceUdid: binding.udid,
      deviceName: device?.name ?? binding.name,
      deviceModel: device?.model ?? binding.model ?? binding.name,
      deviceType: device?.deviceType ?? binding.deviceType ?? null,
      deviceRuntime: device?.runtime ?? binding.runtime,
      mode,
      scheme: options.scheme?.trim() || null,
      project: options.project?.trim() || null,
      workspace: options.workspace?.trim() || null,
      command: options.command?.trim() || null,
      onlyTesting: options.onlyTesting?.trim() || null,
      status: 'queued',
      step: 'queue',
      startedAt: Date.now(),
      endedAt: null,
      exitCode: null,
      summary: null,
      detail: null,
      stats: { passed: 0, failed: 0, failedTests: [], lastError: null },
      notice: null,
      error: null,
      shot: null,
      shotAt: null,
      tail: '',
      lines: 0,
      child: null,
      stream: createWriteStream(join(runsDir, `job-${jobId}.log`), { flags: 'a' }),
    }
    jobs.unshift(job)
    if (jobs.length > MAX_JOBS) jobs.length = MAX_JOBS
    live.set(job.id, job)
    prefs.set(sessionId, {
      ...(prefs.get(sessionId) ?? {}),
      mode,
      ...(job.scheme ? { scheme: job.scheme } : {}),
      ...(job.command ? { command: job.command } : {}),
    })
    persistSoon()
    logLine(job, `· 会话「${session.title}」→ ${job.deviceName}（${job.deviceRuntime ?? ''}）`)
    logLine(job, `· 模式：${mode}`)
    executeJob(job).catch((error) => finishJob(job, 'failed', { error: errorMessage(error) }))
    return { ok: true, message: `已在 ${job.deviceName} 上开始验证`, job: publicJob(job) }
  }

  /** @param {string | undefined} jobId @param {string | undefined} sessionId */
  function findJob(jobId, sessionId) {
    if (jobId) return jobs.find((job) => job.id === jobId)
    if (sessionId) return recentJobsForSession(sessionId)[0]
    return jobs[0]
  }

  async function dispatch(action, payload) {
    switch (action) {
      case 'state':
        return { ok: true, ...(await snapshot()) }
      case 'assign':
        return assignSession(payload.sessionId, payload.deviceUdid ?? null)
      case 'run':
        return startRun(payload.sessionId, payload)
      case 'stop': {
        const job = findJob(payload.jobId, payload.sessionId)
        if (!job) return { ok: false, error: { code: 'job_not_found', message: '找不到该验证任务' } }
        if (!killJob(job)) return { ok: false, error: { code: 'job_not_running', message: '该任务已经结束' } }
        return { ok: true, message: '已请求停止', job: publicJob(job) }
      }
      case 'open': {
        const udid = payload.deviceUdid ?? assignmentOf(payload.sessionId)?.udid
        if (!udid) return { ok: false, error: { code: 'no_device', message: '该会话还没有绑定模拟器' } }
        await openSimulator(udid)
        return { ok: true, message: '已打开模拟器' }
      }
      case 'screenshot': {
        const job = findJob(payload.jobId, payload.sessionId)
        const udid = payload.deviceUdid ?? job?.deviceUdid ?? assignmentOf(payload.sessionId)?.udid
        if (!udid) return { ok: false, error: { code: 'no_device', message: '没有可用于截图的模拟器' } }
        const device = await findDevice(udid)
        if (device && !device.booted) return { ok: false, error: { code: 'device_off', message: '模拟器还没启动' } }
        const path = join(shotsDir, `manual-${Date.now()}.png`)
        const result = await execCollect(XCRUN, ['simctl', 'io', udid, 'screenshot', path], { timeoutMs: 30000 })
        if (result.code !== 0) return { ok: false, error: { code: 'shot_failed', message: result.stderr.trim() || '截图失败' } }
        return { ok: true, message: '截图已保存', shot: `${ROUTE}/shot/${basename(path)}` }
      }
      case 'ui': {
        if (typeof payload.onlyAssigned === 'boolean') ui.onlyAssigned = payload.onlyAssigned
        if (typeof payload.showAll === 'boolean') ui.showAll = payload.showAll
        for (const key of ['collapsed', 'openLogs', 'hiddenShots']) {
          if (Array.isArray(payload[key])) {
            ui[key] = payload[key].filter((value) => typeof value === 'string').slice(-200)
          }
        }
        ui.updatedAt = Date.now()
        persistSoon()
        return { ok: true, ui: { ...ui } }
      }
      case 'settings': {
        if (typeof payload.autoAssign === 'boolean') settings.autoAssign = payload.autoAssign
        if (typeof payload.notify === 'boolean') settings.notify = payload.notify
        if (typeof payload.autoOpen === 'boolean') settings.autoOpen = payload.autoOpen
        persistSoon()
        return { ok: true, message: '设置已更新', settings: { ...settings } }
      }
      case 'refresh':
        devicesCache = null
        sessionsCache = null
        return { ok: true, message: '已刷新' }
      default:
        return { ok: false, error: { code: 'unknown_action', message: `未知操作 ${action}` } }
    }
  }

  // ---------------------------------------------------------------- HTTP API

  /** @param {import('node:http').ServerResponse} res @param {number} status @param {unknown} body */
  function sendJson(res, status, body) {
    const text = JSON.stringify(body)
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(text),
    })
    res.end(text)
  }

  /** @param {import('node:http').IncomingMessage} req */
  async function readBody(req) {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > 64 * 1024) throw new Error('request body too large')
      chunks.push(chunk)
    }
    if (!chunks.length) return {}
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  }

  /** @param {import('node:http').IncomingMessage} req */
  function sameOrigin(req) {
    const origin = req.headers.origin
    if (!origin) return true
    try {
      return origin === ctx.webServer.getOrigin()
    } catch {
      return false
    }
  }

  /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
  async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname

    if (path === `${ROUTE}/state` && req.method === 'GET') {
      sendJson(res, 200, await snapshot())
      return
    }

    if (path === `${ROUTE}/action` && req.method === 'POST') {
      if (!sameOrigin(req)) {
        sendJson(res, 403, { ok: false, error: { code: 'origin', message: 'origin not allowed' } })
        return
      }
      let payload
      try {
        payload = await readBody(req)
      } catch (error) {
        sendJson(res, 400, { ok: false, error: { code: 'bad_request', message: errorMessage(error) } })
        return
      }
      const action = typeof payload.action === 'string' ? payload.action : ''
      try {
        sendJson(res, 200, await dispatch(action, payload))
      } catch (error) {
        sendJson(res, 500, { ok: false, error: { code: 'internal', message: errorMessage(error) } })
      }
      return
    }

    if (path.startsWith(`${ROUTE}/shot/`) && req.method === 'GET') {
      const name = path.slice(`${ROUTE}/shot/`.length)
      if (!/^[\w.-]+\.png$/.test(name)) {
        res.writeHead(404)
        res.end()
        return
      }
      try {
        const bytes = await readFile(join(shotsDir, name))
        res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store', 'content-length': bytes.length })
        res.end(bytes)
      } catch {
        res.writeHead(404)
        res.end()
      }
      return
    }

    if (path.startsWith(`${ROUTE}/log/`) && req.method === 'GET') {
      const id = path.slice(`${ROUTE}/log/`.length)
      const job = jobs.find((item) => item.id === id)
      if (!job) {
        res.writeHead(404)
        res.end('job not found')
        return
      }
      const file = join(runsDir, `job-${id}.log`)
      let text = ''
      try {
        text = await readFile(file, 'utf8')
      } catch {}
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
      res.end(text || job.tail || '(no log yet)')
      return
    }

    res.writeHead(404)
    res.end('not found')
  }

  // ---------------------------------------------------------------- agent tool

  const TOOL = {
    name: 'ios_simulator',
    description:
      'Verify iOS UI on a real simulator without blocking the conversation. Each DSH session is bound to its own simulator, so parallel sessions never share a device. ' +
      'Actions: "list" shows devices, bindings and recent jobs; "assign" binds a device to a session (omit sessionId for this session); ' +
      '"run" starts build/install/UI-test in the background and returns immediately with a job id; "status" reports progress and can wait a bounded number of seconds; ' +
      '"stop" cancels; "open" brings the simulator to the foreground; "screenshot" captures the current screen. ' +
      'After "run", tell the user which device is being used; poll "status" only when you need the result now, otherwise the user is notified when the run finishes.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'assign', 'run', 'status', 'stop', 'open', 'screenshot'],
          description: 'Operation to perform.',
        },
        sessionId: { type: 'string', description: 'Target DSH session id. Defaults to the calling session.' },
        deviceUdid: { type: 'string', description: 'Simulator UDID for assign/open/screenshot, or a one-off device for run.' },
        mode: {
          type: 'string',
          enum: ['build', 'install', 'test', 'command'],
          description: 'install (default) builds, installs and launches the app; test runs xcodebuild test; build only compiles; command runs a custom shell command.',
        },
        scheme: { type: 'string', description: 'Xcode scheme. Auto-detected when omitted.' },
        project: { type: 'string', description: 'Absolute path to an .xcodeproj when it is not in the session directory.' },
        workspace: { type: 'string', description: 'Absolute path to an .xcworkspace when it is not in the session directory.' },
        command: { type: 'string', description: 'Shell command for mode="command". $DSH_SIM_UDID / $DSH_SIM_NAME are exported.' },
        jobId: { type: 'string', description: 'Job id for status/stop; defaults to the latest job of the session.' },
        waitSeconds: { type: 'integer', description: 'For status: wait up to this many seconds (max 240) for the job to finish.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', properties: {}, additionalProperties: true },
      render(_args, value) {
        const record = value && typeof value === 'object' ? value : {}
        const text =
          typeof record.message === 'string' && record.message
            ? record.message
            : JSON.stringify(value, null, 2).slice(0, 6000)
        return [{ type: 'text', text }]
      },
    },
    timeoutMs: 300000,
    isConcurrencySafe() {
      return false
    },
    async execute(args, exec) {
      const input = args && typeof args === 'object' ? args : {}
      const sessionId = typeof input.sessionId === 'string' && input.sessionId ? input.sessionId : exec.agent?.id
      const action = input.action

      if (action === 'list') {
        const { devices, sessions } = await sessionsWithState()
        const bound = sessions.filter((session) => session.assignment)
        const free = devices.filter((device) => !device.boundTo)
        const lines = [
          `${devices.length} 台可用模拟器（${free.length} 台空闲），${bound.length} 个会话已绑定设备。`,
          ...bound.slice(0, 20).map((session) => {
            const job = session.activeJob ?? session.lastJob
            const state = session.activeJob ? '运行中' : job ? `${job.status} · ${job.deviceName}` : '空闲'
            return `- [${session.workspaceName}] ${session.title} (${session.id}) → ${session.assignment.model} · ${state}`
          }),
        ]
        if (sessionId) {
          const mine = sessions.find((session) => session.id === sessionId)
          lines.push(
            mine?.assignment
              ? `本会话锁定机型 ${mine.assignment.model}（${mine.assignment.runtime}，${mine.assignment.state}）`
              : '本会话还没有绑定模拟器：run 时会自动分配一台空闲设备（确定机型后可在面板锁定）。',
          )
        }
        return {
          ok: true,
          message: lines.join('\n'),
          devices: devices.map((device) => ({
            udid: device.udid,
            name: device.name,
            runtime: device.runtime,
            state: device.state,
            boundTo: device.boundTo,
            busy: device.busy,
          })),
          sessions: sessions.map((session) => ({
            id: session.id,
            title: session.title,
            cwd: session.cwd,
            assignment: session.assignment,
            activeJob: session.activeJob,
          })),
        }
      }

      if (action === 'assign') {
        if (!sessionId) return { ok: false, message: '缺少 sessionId' }
        const result = await assignSession(sessionId, input.deviceUdid ? String(input.deviceUdid) : null)
        return result.ok ? { ...result, message: result.message } : result
      }

      if (action === 'run') {
        if (!sessionId) return { ok: false, message: '缺少 sessionId' }
        const result = await startRun(sessionId, {
          mode: typeof input.mode === 'string' ? input.mode : undefined,
          scheme: typeof input.scheme === 'string' ? input.scheme : undefined,
          project: typeof input.project === 'string' ? input.project : undefined,
          workspace: typeof input.workspace === 'string' ? input.workspace : undefined,
          command: typeof input.command === 'string' ? input.command : undefined,
          deviceUdid: typeof input.deviceUdid === 'string' ? input.deviceUdid : undefined,
        })
        if (!result.ok) {
          return { ...result, message: result.error?.message ?? '无法启动验证' }
        }
        return {
          ...result,
          message: `已在「${result.job.deviceModel}」（${result.job.deviceRuntime}）上启动 ${result.job.mode} 验证（工作区 ${result.job.workspaceName}，机型已锁定），job ${result.job.id}。任务在后台运行，不会阻塞会话；完成时会通知用户。可稍后用 action="status" 查看。`,
        }
      }

      if (action === 'status') {
        const job = findJob(input.jobId ? String(input.jobId) : undefined, sessionId)
        if (!job) return { ok: false, message: '没有找到验证任务' }
        const waitSeconds = Math.min(Math.max(Number(input.waitSeconds) || 0, 0), 240)
        if (waitSeconds > 0 && isActive(job)) {
          const deadline = Date.now() + waitSeconds * 1000
          while (Date.now() < deadline && isActive(job)) {
            await sleep(1000)
            if (exec.signal?.aborted) break
          }
        }
        const view = publicJob(job)
        const tail = view.tail.split('\n').slice(-25).join('\n')
        return {
          ok: true,
          message: `job ${view.id} · ${view.status} · ${view.step} · ${view.deviceModel} · ${view.workspaceName}${view.summary ? ` · ${view.summary}` : ''}${view.detail ? ` · ${view.detail}` : ''}\n${tail}`,
          job: view,
        }
      }

      if (action === 'stop') {
        const job = findJob(input.jobId ? String(input.jobId) : undefined, sessionId)
        if (!job) return { ok: false, message: '没有找到验证任务' }
        if (!killJob(job)) return { ok: false, message: '该任务已经结束' }
        return { ok: true, message: '已请求停止', job: publicJob(job) }
      }

      if (action === 'open') {
        const udid = input.deviceUdid ? String(input.deviceUdid) : sessionId ? assignmentOf(sessionId)?.udid : undefined
        if (!udid) return { ok: false, message: '该会话还没有绑定模拟器' }
        await openSimulator(udid)
        return { ok: true, message: '已打开模拟器' }
      }

      if (action === 'screenshot') {
        return dispatch('screenshot', {
          sessionId,
          jobId: input.jobId ? String(input.jobId) : undefined,
          deviceUdid: input.deviceUdid ? String(input.deviceUdid) : undefined,
        })
      }

      return { ok: false, message: `未知操作 ${String(action)}` }
    },
  }

  // ---------------------------------------------------------------- registration

  ctx.effect(() => ctx.tools.register(TOOL), 'ios-simulator: tool')
  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: ROUTE, handler: handle }),
    'ios-simulator: http routes',
  )
  ctx.effect(() => () => {
    for (const job of live.values()) {
      try {
        if (job.child?.pid) process.kill(-job.child.pid, 'SIGINT')
      } catch {}
    }
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    persistNow()
  }, 'ios-simulator: teardown')

  ctx.logger?.info?.(`[ios-simulator] ready at ${ROUTE} (data: ${dataDir})`)
}

export const inject = ['webServer', 'tools']

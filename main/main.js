// [YAMI RPG EDITOR]主线程

// ******************************** 加载模块 ********************************
const Koa = require('koa')
const Mime = require('mime-types')
const QRCode = require('qrcode')
const ExcelJS = require('exceljs')
const apkProcessor = require('./apk.js')
const { app, Menu, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const fs = require('fs')
const { fork } = require('child_process')
const path = require('path')
const os = require('os')
const ts = require('typescript')

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true' // 关闭警告

// 如果启动时包含dirname参数
// 表示应用运行在node.js调试模式中
// 重定向根目录并开启应用的调试模式
let debug = false
let dirname = app.getAppPath()
const regexp = /^--dirname=(.+)$/
for (const arg of process.argv) {
	if ((match = arg.match(regexp))) {
		dirname = path.resolve(dirname, match[1])
		debug = true
		break
	}
}
const generate32bit = () => {
	const n = Math.random() * 0x100000000
	const s = Math.floor(n).toString(16)
	return s.length === 8 ? s : s.padStart(8, '0')
}
function generate64bit() {
	let id
	// GUID通常用作哈希表的键
	// 避免纯数字的键(会降低访问速度)
	do {
		id = generate32bit() + generate32bit()
	} while (!/[a-f]/.test(id))
	return id
}

function getLocalIpAddress() {
	const interfaces = os.networkInterfaces()
	const results = new Set()

	for (const name of Object.keys(interfaces)) {
		for (const iface of interfaces[name]) {
			if (iface.family !== 'IPv4' || iface.internal !== false) continue

			results.add(iface.address)
		}
	}

	return Array.from(results)
}

// ******************************** 本地开发服务器 ********************************
let isServerState = false
ipcMain.on('get-server-state', (event) => {
	event.returnValue = isServerState
})
ipcMain.handle('start-server', (event, config) => {
	const basePath = path.dirname(config.path)
	const instanceServer = new Koa()
	instanceServer.use(async (ctx) => {
		try {
			const filePath = path.join(basePath, '.preview', ctx.path)
			const ext = path.extname(filePath)
			const type = Mime.lookup(ext) || 'text/plain'
			if (ctx.path === '/') {
				ctx.set('Content-Type', Mime.lookup('html'))
				ctx.body = fs.readFileSync(path.join(filePath, 'index.html'))
			} else {
				ctx.set('Content-Type', type)
				ctx.body = fs.readFileSync(filePath)
			}
		} catch {
			ctx.body = '404 Not Found'
		}
	})

	const server = instanceServer.listen(config.port, () => {
		isServerState = true
		console.log(`Start Server on http://localhost:${config.port}.`)
	})

	ipcMain.handleOnce('stop-server', () => {
		isServerState = false
		server.close()
		instanceServer.emit('close')
	})
})

ipcMain.handle('to-qrcode', (event, url) => {
	return QRCode.toDataURL(url, { errorCorrectionLevel: 'H' })
		.then((url) => {
			return url
		})
		.catch((err) => {
			console.error(err)
		})
})

ipcMain.handle('get-local-ip', (event) => {
	return getLocalIpAddress()
})

// to-excel
ipcMain.handle('to-excel', async (event, { langs, list }) => {
	const workbook = new ExcelJS.Workbook()
	const worksheet = workbook.addWorksheet('open-yami')
	worksheet.columns = [
		{ header: 'ID', key: 'id', width: 20 },
		{ header: 'Name', key: 'name', width: 10 },
		...langs.map((v) => ({ header: v, key: v, width: 10 })),
		{ header: 'parentID', key: 'parentID', width: 20 },
		{ header: 'isDir', key: 'isDir', width: 10 }
	]
	const transformList = (DataList, parentID) => {
		for (let item of DataList) {
			if (item?.class) {
				const id = generate64bit()
				transformList(item.children, id, true)
				worksheet.addRow({
					id: id,
					name: item.name || '',
					parentID,
					isDir: 1
				})
			} else {
				// 基础数据
				const data = {
					id: item.id,
					name: item.name || '',
					parentID
				}
				langs.forEach((v) => {
					data[v] = item.contents[v]
				})
				worksheet.addRow(data)
			}
		}
	}
	transformList(list)
	const window = getWindowFromEvent(event)
	dialog
		.showSaveDialog(window, {
			title: '保存到Excel',
			filters: [{ name: 'Excel(翻译文件)', extensions: ['xlsx'] }]
		})
		.then((result) => {
			if (result.canceled) return
			const filePath = result.filePath
			return workbook.xlsx.writeFile(filePath)
		})
})

// from-excel
ipcMain.handle('from-excel', async (event) => {
	try {
		const window = getWindowFromEvent(event)
		const { filePaths, canceled } = await dialog.showOpenDialog(window, {
			title: '选择导入翻译文件',
			filters: [{ name: 'Excel(翻译文件)', extensions: ['xlsx'] }],
			properties: ['openFile']
		})

		if (canceled || !filePaths || filePaths.length === 0) return []

		const filePath = filePaths[0]
		const workbook = new ExcelJS.Workbook()
		await workbook.xlsx.readFile(filePath)

		const worksheet = workbook.getWorksheet('open-yami')

		if (!worksheet) return []

		// 解析表头获取语言列
		const headerRow = worksheet.getRow(1)
		const headers = headerRow.values.slice(1) // 跳过第一个空值
		const langColumns = headers.filter(
			(header) => !['ID', 'Name', 'parentID', 'isDir'].includes(header)
		)
		// 构建数据结构
		const dataMap = new Map()
		const rootNodes = []

		// 从第二行开始遍历数据
		for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
			const row = worksheet.getRow(rowIndex)
			const isDir = row.getCell(headers.indexOf('isDir') + 1).value === 1
			const rowData = isDir
				? {
						class: 'folder',
						id: row.getCell(headers.indexOf('ID') + 1).value,
						name:
							row.getCell(headers.indexOf('Name') + 1).value ||
							'',
						parentID: row.getCell(headers.indexOf('parentID') + 1)
							.value,
						expanded: false,
						children: []
					}
				: {
						id: row.getCell(headers.indexOf('ID') + 1).value,
						name: row.getCell(headers.indexOf('Name') + 1).value,
						parentID: row.getCell(headers.indexOf('parentID') + 1)
							.value,
						contents: {}
					}
			if (!isDir) {
				// 收集多语言内容
				langColumns.forEach((lang) => {
					const cellValue = row.getCell(
						headers.indexOf(lang) + 1
					).value
					rowData.contents[lang] = cellValue !== null ? cellValue : ''
				})
			}

			let parent = dataMap.get(rowData.id)
			if (parent && parent.class === 'folder') {
				rowData.children = parent.children
				dataMap.delete(rowData.id)
			}
			dataMap.set(rowData.id, rowData)

			// 挂载到父节点或作为根节点
			if (rowData.parentID) {
				const parent = dataMap.get(rowData.parentID)
				if (parent) {
					parent.children = parent.children || []
					parent.children.push(rowData)
				} else {
					dataMap.set(rowData.parentID, {
						class: 'folder',
						id: rowData.parentID,
						name: '',
						expanded: false,
						children: [rowData]
					})
				}
			} else {
				rootNodes.push(rowData)
			}
		}
		return rootNodes
	} catch {
		return []
	}
})

// ******************************** 文件系统 ********************************

// 获取存档目录Sync
ipcMain.on('get-dir-path-sync', (event, location) => {
	switch (location) {
		case 'app-data':
			event.returnValue = app.getPath('appData')
		case 'documents':
			event.returnValue = app.getPath('documents')
		case 'desktop':
			event.returnValue = app.getPath('desktop')
		case 'local':
			event.returnValue = app.getAppPath()
	}
})

// 获取存档目录
ipcMain.handle('get-dir-path', (event, location) => {
	switch (location) {
		case 'app-data':
			return app.getPath('appData')
		case 'documents':
			return app.getPath('documents')
		case 'desktop':
			return app.getPath('desktop')
		case 'local':
			return app.getAppPath()
	}
})

// 写入文件
ipcMain.handle('write-file', (event, filePath, text, check) => {
	return protectPromise(writeFile(filePath, text, check))
})

// 等待写入文件
ipcMain.handle('wait-write-file', (event) => {
	return Promise.allSettled(promises)
})

// 异步写入文件
const FSP = require('fs').promises
const writeFile = async (filePath, text, check) => {
	if (check) await FSP.stat(filePath)
	return FSP.writeFile(filePath, text)
}

// 保护承诺对象
const promises = []
const protectPromise = function (promise) {
	promises.push(promise)
	promise.finally(() => {
		const index = promises.indexOf(promise)
		if (index !== -1) {
			promises.splice(index, 1)
		}
	})
	return promise
}

// ******************************** 注册事件 ********************************

const extensionPath = path.join('./extension')
// 准备完毕
app.on('ready', () => {
	createEditorMenu()
	createEditorWindow()
	const isExtension = fs.existsSync(extensionPath)
	if (!isExtension) fs.mkdirSync(extensionPath)
	const dirs = fs.readdirSync(extensionPath)
	dirs.forEach(async (v) => {
		try {
			await session.defaultSession.loadExtension(v)
		} catch {}
	})
})

// 窗口全部关闭后退出应用
app.on('window-all-closed', () => {
	app.quit()
})

// 阻止退出直到写入完成
app.on('before-quit', async (event) => {
	event.preventDefault()
	await Promise.allSettled(promises)
	app.exit()
})

// ******************************** 创建编辑器菜单栏 ********************************

const createEditorMenu = function () {
	// 创建模板
	const template = createMenuTemplate()

	// 设置菜单
	const menu = Menu.buildFromTemplate(template)
	Menu.setApplicationMenu(menu)
}

// ******************************** 创建编辑器菜单栏 ********************************

const createMenuTemplate = function () {
	const template = []
	const file = {
		label: 'File',
		submenu: []
	}
	const edit = {
		label: 'Edit',
		submenu: []
	}
	// 开发模式：开启F5刷新
	if (debug) {
		file.submenu.push({
			label: 'Reload',
			accelerator: 'F5',
			role: 'forceReload'
		})
	}
	// F11全屏
	if (process.platform !== 'darwin') {
		file.submenu.push({
			label: 'FullScreen',
			accelerator: 'F11',
			role: 'toggleFullScreen'
		})
	}
	// F12开发者工具
	file.submenu.push({
		label: 'Toogle DevTools',
		accelerator: 'F12',
		role: 'toggleDevTools'
	})
	// 启用MacOS开发者工具的复制粘贴操作(但跟编辑器冲突)
	if (process.platform === 'darwin' && debug) {
		edit.submenu.push(
			{ role: 'undo' },
			{ role: 'redo' },
			{ type: 'separator' },
			{ role: 'cut' },
			{ role: 'copy' },
			{ role: 'paste' },
			{ role: 'selectAll' }
		)
	}
	if (file.submenu.length !== 0) {
		template.push(file)
	}
	if (edit.submenu.length !== 0) {
		template.push(edit)
	}
	return template
}

// ******************************** 创建编辑器窗口 ********************************

const createEditorWindow = function () {
	// 创建窗口
	const editor = new BrowserWindow({
		title: 'Yami RPG Editor',
		width: 1600,
		height: 900,
		useContentSize: true,
		backgroundColor: 'white',
		frame: process.platform === 'darwin',
		show: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			spellcheck: false,
			additionalArguments: debug ? ['--debug-mode'] : []
		}
	})

	// 隐藏菜单栏
	editor.setMenuBarVisibility(process.platform === 'darwin')

	// 加载文件
	editor.loadFile(path.resolve(dirname, 'index.html'))

	// 侦听窗口模式切换事件
	editor.on('maximize', (event) => editor.send('maximize'))
	editor.on('unmaximize', (event) => editor.send('unmaximize'))
	editor.on('enter-full-screen', (event) => editor.send('enter-full-screen'))
	editor.on('leave-full-screen', (event) => editor.send('leave-full-screen'))

	// 加载配置文件并设置缩放系数
	const configPath = path.resolve(dirname, 'config.json')
	const promise = require('fs').promises.readFile(configPath)
	editor.once('ready-to-show', (event) => {
		// 窗口最大化
		editor.maximize()
		promise
			.then((config) => {
				editor.webContents.setZoomFactor(JSON.parse(config).zoom)
			})
			.catch((error) => {
				editor.webContents.setZoomFactor(1)
			})
	})
	// 侦听窗口关闭事件
	editor.on('close', (event) => {
		if (!editor.stopCloseEvent) {
			apkProcessor.abortBuild()
			new Promise((r) => stopTSC(r))
			editor.send('before-close-window')
			event.preventDefault()
			// 如果渲染线程未响应，超时2秒后退出应用
			setTimeout(() => {
				if (!editor.stopCloseEvent) {
					editor.stopCloseEvent = true
					editor.close()
				}
			}, 2000)
		}
	})

	global.editor = editor

	// 构建APK
	ipcMain.handle('build-apk', (event, config) => {
		if (apkProcessor.isBuilding()) {
			editor.send('apk-log', {
				done: true,
				msg: `当前已有构建任务正在进行中`
			})
			return
		}
		try {
			apkProcessor.main({
				config,
				onProgress: (step, percentage, isError) => {
					if (isError) {
						editor.send('apk-log', {
							done: true,
							msg: `[${percentage}%] 错误: ${step}`
						})
					} else {
						const data = {
							done: false,
							msg: `[${percentage}%] 进度: ${step}`
						}
						if (step == 100) {
							data.done = true
						}
						editor.send('apk-log', data)
					}
				}
			})
		} catch (err) {
			editor.send('apk-log', {
				done: true,
				msg: `错误: ${err}`
			})
		}
	})
	ipcMain.on('isBuilding-apk', (event) => {
		event.returnValue = apkProcessor.isBuilding()
	})

	// 停止构建APK
	ipcMain.handle('stop-build-apk', (event) => {
		apkProcessor.abortBuild()
	})

	// 启动TSC事件
	ipcMain.on('start-tsc', (event, projectDir) => {
		startTSC(path.normalize(projectDir))
	})

	// 停止TSC事件
	ipcMain.on('stop-tsc', (event) => {
		stopTSC()
	})

	// 编译TS代码
	ipcMain.handle('tsc-file', (event, code) => {
		let res
		let error
		try {
			res = ts.transpileModule(code, {
				target: ts.ScriptTarget.ES2022, // 编译目标版本
				module: ts.ModuleKind.ESNext, // 模块系统
				strict: true // 启用严格模式
			})
		} catch (e) {
			error = e
		}
		return Promise.resolve({ res: res.outputText, error })
	})

	let tscProcess = null

	// 启动TSC
	function startTSC(projectDir) {
		if (tscProcess) {
			stopTSC(() => startTSC(projectDir))
			return
		}
		// 启动'tsc --watch'进程
		const tscPath = path.join(
			__dirname,
			'../node_modules',
			'typescript',
			'lib',
			'tsc.js'
		)
		tscProcess = fork(tscPath, ['--watch'], {
			stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
			cwd: projectDir,
			execPath: process.execPath
		})
		// 监听 stdout（正常输出）
		tscProcess.stdout.on('data', (data) => {
			editor.send('tsc-log', data.toString())
		})
		// 监听 stderr（错误输出）
		tscProcess.stderr.on('data', (data) => {
			editor.send('tsc-log', data.toString())
		})
	}

	// 停止TSC
	function stopTSC(callback) {
		if (tscProcess) {
			tscProcess.kill()
			tscProcess.on('close', () => {
				tscProcess = null
				callback?.()
			})
		} else {
			callback?.()
		}
	}
}

// ******************************** 创建播放器窗口 ********************************

const createPlayerWindow = function (parent, projectDir) {
	// 加载配置文件
	const fs = require('fs')
	const config = path.resolve(projectDir, 'Data/config.json')
	const window = JSON.parse(fs.readFileSync(config)).window

	// WIN窗口大小调整：减去菜单栏的高度
	let windowHeight = window.height
	if (process.platform === 'win32') {
		windowHeight = Math.max(windowHeight - 20, 0)
	}

	// 创建窗口
	const player = new BrowserWindow({
		icon: `${projectDir}Icon/icon.png`,
		title: window.title,
		width: window.width,
		height: windowHeight,
		useContentSize: true,
		backgroundColor: 'black',
		show: false,
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			spellcheck: false,
			additionalArguments: ['--debug-mode']
		}
	})
	player.config = window

	// 隐藏菜单栏
	player.setMenuBarVisibility(false)

	// 加载页面文件
	player.loadFile(`${projectDir}index.html`)

	// 设置窗口模式
	player.once('ready-to-show', (event) => {
		player.show()
		switch (window.display) {
			case 'windowed':
				break
			case 'maximized':
				player.maximize()
				break
			case 'fullscreen':
				player.setFullScreen(true)
				break
		}
	})

	// 侦听窗口关闭事件
	player.on('close', (event) => {
		if (!player.stopCloseEvent) {
			player.send('before-close-window')
			event.preventDefault()
			// 如果渲染线程未响应，超时2秒后关闭窗口
			setTimeout(() => {
				if (!player.stopCloseEvent) {
					player.stopCloseEvent = true
					player.close()
				}
			}, 2000)
		}
	})

	// 侦听窗口关闭事件
	player.once('closed', () => {
		if (!parent.isDestroyed()) {
			parent.send('player-window-closed')
		}
	})
}

// ******************************** 进程通信 ********************************

// 获取事件来源窗口
const getWindowFromEvent = function (event) {
	return BrowserWindow.fromWebContents(event.sender)
}

// 最小化窗口
ipcMain.on('minimize-window', (event) => {
	const window = getWindowFromEvent(event)
	if (window.isMinimized()) {
		window.restore()
	} else {
		window.minimize()
	}
})

// 最大化窗口
ipcMain.on('maximize-window', (event) => {
	const window = getWindowFromEvent(event)
	if (!window.isFullScreen()) {
		if (window.isMaximized()) {
			window.unmaximize()
		} else {
			window.maximize()
		}
	}
})

// 关闭窗口
ipcMain.on('close-window', (event) => {
	const window = getWindowFromEvent(event)
	window.close()
})

// 强制关闭窗口
ipcMain.on('force-close-window', (event) => {
	const window = getWindowFromEvent(event)
	window.stopCloseEvent = true
	window.close()
})

// 开关全屏模式
ipcMain.on('toggle-full-screen', (event) => {
	const window = getWindowFromEvent(event)
	window.setFullScreen(!window.isFullScreen())
})

// 打开资源管理器路径
ipcMain.on('open-path', (event, targetPath) => {
	shell.openPath(path.normalize(targetPath))
})

// 使用VSCode打开脚本
ipcMain.on('open-vscode', (event, scriptPath, line, column) => {
	const url = `${path.normalize(scriptPath)}:${line}:${column}`
	shell.openExternal(`vscode://file/${url}`)
})

// 在资源管理器中显示
ipcMain.on('show-item-in-folder', (event, filePath) => {
	shell.showItemInFolder(path.normalize(filePath))
})

// 创建播放器窗口
ipcMain.on('create-player-window', (event, projectPath) => {
	const window = getWindowFromEvent(event)
	createPlayerWindow(window, projectPath)
})

// 更新最大小化图标
ipcMain.handle('update-max-min-icon', (event) => {
	const window = getWindowFromEvent(event)
	return window.isMaximized()
		? 'maximize'
		: window.isFullScreen()
			? 'enter-full-screen'
			: 'unmaximize'
})

// 显示打开对话框
ipcMain.handle('show-open-dialog', (event, options) => {
	const window = getWindowFromEvent(event)
	return dialog.showOpenDialog(window, options)
})

// 显示保存对话框
ipcMain.handle('show-save-dialog', (event, options) => {
	const window = getWindowFromEvent(event)
	return dialog.showSaveDialog(window, options)
})

// 把文件扔进回收站
ipcMain.handle('trash-item', (event, filePath) => {
	return shell.trashItem(path.normalize(filePath))
})

// 设置设备像素比率
ipcMain.on('set-device-pixel-ratio', (event, ratio) => {
	const window = getWindowFromEvent(event)
	// MacOS不像Windows一样锁定窗口最大化
	if (process.platform === 'darwin') {
		if (window.isMaximized() || window.isFullScreen()) {
			return
		}
	}
	const bounds = window.getContentBounds()
	const config = window.config
	const width = Math.round(config.width / ratio)
	const height = Math.round(config.height / ratio)
	const x = bounds.x + ((bounds.width - width) >> 1)
	const y = bounds.y + ((bounds.height - height) >> 1)
	// electron bug：非100%缩放时，窗口位置不能完美地被设置
	window.setContentBounds({ x, y, width, height })
})

// 打开开发者工具
ipcMain.on('open-devTools', (event) => {
	event.sender.openDevTools()
})

// 设置显示模式
ipcMain.on('set-display-mode', (event, display) => {
	const window = getWindowFromEvent(event)
	switch (display) {
		case 'windowed':
			if (window.isFullScreen()) {
				window.setFullScreen(false)
			}
			if (window.isMaximized()) {
				window.unmaximize()
			}
			break
		case 'maximized':
			if (window.isFullScreen()) {
				window.setFullScreen(false)
			}
			if (!window.isMaximized()) {
				window.maximize()
			}
			break
		case 'fullscreen':
			if (!window.isFullScreen()) {
				window.setFullScreen(true)
			}
			break
	}
})

/* 小改动或者不确定放哪的都可以放这 */
const fs = require('fs-extra')
const yauzl = require('yauzl')

const CommunityVersion = '25103001' // 社区编辑器版本

EventBus.once('editor_loaded', () => {
	// 更新项目数据
	const checkForProjectUpdatesOrigin = Editor.checkForProjectUpdates
	Editor.checkForProjectUpdates = function (verNum) {
		checkForProjectUpdatesOrigin.call(this, verNum)
		// 增加缺失的属性
		if (!Data.config.deadzone) {
			Data.config.deadzone = 0.4
			Project.changed = true
		}
	}
})

let PackMeta = JSON.parse(
	require('fs').readFileSync(
		Path.join(__dirname, 'Script/module', 'packmeta.json')
	)
) // 资源 meta 信息

const TemplatesPath = Path.resolve(GlobalPath, 'Templates') // 模板路径
if (!fs.existsSync(TemplatesPath))
	fs.mkdirSync(TemplatesPath, { recursive: true })

// 检测是否安装了资源包
function isNoResource() {
	const bak = JSON.parse(JSON.stringify(PackMeta))
	delete bak['Editor']
	delete bak['Project']
	delete bak['Community']
	const p = { ...bak }
	Object.defineProperty(p, '@', {
		value: false,
		enumerable: false,
		writable: true
	})
	try {
		const checkArr = []
		// 分别检测包是否存在
		Object.keys(p).map((v) => {
			p[v] = {}
			p[v]['check'] = false
			const _path = Path.resolve(TemplatesPath, v)
			if (fs.existsSync(_path)) {
				p[v]['check'] = true
				checkArr.push(true)
			} else {
				checkArr.push(false)
			}
		})
		if (checkArr.every((v) => v)) p['@'] = true
		return p
	} catch {
		return p
	}
}

let NoResourceObj = isNoResource()

window.addEventListener('localize', () => {
	Resources.initialize() // 初始化
	if (!Resources.checkResources()) {
		Resources.open(true)
		Resources.checkEditorVersion() // 只检测编辑器版本
	} else {
		Resources.checkVersion()
	}
	Resources.loaded = true // 已检查过资源
})

const TitleNewProjectOld = Title.newProject
Title.newProject = function () {
	if (!Resources.loaded || !Resources.checkResources()) return // 未初始化不可创建项目
	TitleNewProjectOld.call(Title)
}

// 解压zip
const unzipWithProgress = async ({ zipPath, outputDir, onProgress }) => {
	return new Promise((resolve, reject) => {
		let totalFiles = 0
		let extractedFiles = 0

		// 打开 ZIP 文件
		yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
			if (err) return reject(err)
			zipfile.on('entry', () => {
				totalFiles++
			})
			zipfile.readEntry()
			zipfile.on('entry', (entry) => {
				const destPath = Path.join(outputDir, entry.fileName)

				// 如果是目录，创建目录
				if (/\/$/.test(entry.fileName)) {
					fs.ensureDirSync(destPath)
					zipfile.readEntry()
					return
				}

				// 确保目标目录存在
				fs.ensureDirSync(Path.dirname(destPath))

				// 解压文件
				zipfile.openReadStream(entry, (err, readStream) => {
					if (err) return reject(err)

					const writeStream = fs.createWriteStream(destPath)
					readStream.pipe(writeStream)

					writeStream.on('close', () => {
						extractedFiles++
						const progress = Math.round(
							(extractedFiles / totalFiles) * 100
						)
						onProgress?.(progress)

						zipfile.readEntry()
					})
				})
			})

			zipfile.on('end', () => {
				resolve('解压完成')
			})

			zipfile.on('error', (err) => {
				reject(err)
			})
		})
	})
}

CommandList.prototype.openEdit = function () {
	Window.open('edit-data')
	EditDataInstance.open(this)
}

function find_dItem(fn) {
	var list = this.selections || []
	var cur = list[list.length - 1]
	var next = cur?.element?.nextSibling?.item
	var insertBefore = false

	if (!cur) {
		//什么都没选，直接插入到最底下
		return fn()
	}
	if (cur.class == 'folder') {
		//选中了文件夹
		return fn(cur)
	}
	if (!next) {
		//没有下一个元素，但是当前元素在文件夹内
		if (cur.parent.class == 'folder') {
			return fn(cur.parent)
		}
		return fn()
	}

	//是和自己同一个文件夹内
	if (next.parent == cur.parent) {
		if (next.class == 'folder') {
			insertBefore = true
		}
		return fn(next, insertBefore)
	} else {
		return fn(cur.parent)
	}
}

// 列表 - 粘贴
Scene.list.paste = function (dItem, callback) {
	const copy = Clipboard.read('yami.scene.object')
	if (copy && this.data) {
		switch (copy.class) {
			case 'tilemap':
				Codec.decodeTilemap(copy)
				copy.shortcut = 0
				break
		}

		var insertBefore = false
		if (dItem === 'auto') {
			find_dItem.call(this, (a, b) => {
				dItem = a
				insertBefore = b
			})
		}
		callback?.(copy)
		this.addNodeTo(copy, dItem, insertBefore)
		Scene.requestRendering()
	}
}

// 列表 - 粘贴
Enum.list.paste = function (dItem) {
	const copy = Clipboard.read('yami.data.enumeration')
	if (copy) {
		// 只有冲突时进行更换ID
		// 支持跨项目复制保留ID
		if (Enum.idMap[copy.id]) {
			copy.id = Enum.createId()
			//如果需要去掉后面的 -copy，把下面这行注释就好了
			copy.name += ' - Copy'
		}

		find_dItem.call(this, (a, b) => {
			this.addNodeTo(copy, a, b)
		})
	}
}

// 列表 - 粘贴
Variable.list.paste = function (dItem) {
	const copy = Clipboard.read('yami.data.variable')
	if (copy) {
		// 只有冲突时进行更换ID
		// 支持跨项目复制保留ID
		if (Variable.idMap[copy.id]) {
			copy.id = Variable.createId()
			//如果需要去掉后面的 -copy，把下面这行注释就好了
			copy.name += ' - Copy'
		}

		find_dItem.call(this, (a, b) => {
			this.addNodeTo(copy, a, b)
		})
	}
}

// 列表 - 粘贴
Attribute.list.paste = function (dItem) {
	const copy = Clipboard.read('yami.data.attribute')
	if (copy) {
		// 只有冲突时进行更换ID
		// 支持跨项目复制保留ID
		if (Attribute.idMap[copy.id]) {
			copy.id = Attribute.createId()
			//如果需要去掉后面的 -copy，把下面这行注释就好了
			copy.name += ' - Copy'
		}

		find_dItem.call(this, (a, b) => {
			this.addNodeTo(copy, a, b)
		})
	}
}

// 列表 - 粘贴
Localization.list.paste = function (dItem) {
	const copy = Clipboard.read('yami.data.localization')
	if (copy) {
		// 只有冲突时进行更换ID
		// 支持跨项目复制保留ID
		if (Localization.idMap[copy.id]) {
			copy.id = Localization.createId()
			//如果需要去掉后面的 -copy，把下面这行注释就好了
			copy.name += ' - Copy'
		}
		find_dItem.call(this, (a, b) => {
			this.addNodeTo(copy, a, b)
		})
	}
}

// 列表 - 粘贴
UI.list.paste = function (_, callback) {
	const copy = Clipboard.read('yami.ui.object')
	if (copy && this.data) {
		callback?.(copy)
		this.addNodeTo(copy, UI.target)
		UI.requestRendering()
	}
}

// 主界面 - 版本号
const homeElem = $('#home-version')

homeElem.textContent = `当社区版本：${CommunityVersion} 当前编辑器版本：${Updater.latestEditorVersion} 
当前项目版本：${Updater.latestProjectVersion}`
;(() => {
	PackMeta['Editor'] = Updater.latestEditorVersion
	PackMeta['Project'] = Updater.latestProjectVersion
	PackMeta['Community'] = CommunityVersion
	fs.writeFileSync(
		Path.join(__dirname, 'Script/module', 'packmeta.json'),
		JSON.stringify(PackMeta)
	)
})()

// 自动图块 - 显示引用数量
originAutoTileTemplateUpdate = AutoTile.templateList.update
AutoTile.templateList.update = function () {
	originAutoTileTemplateUpdate.call(this)
	const autoList = Object.keys(Data.tilesets)
		.map((v) => Data.tilesets[v])
		.filter((v) => v.type === 'auto')
	const countMap = {}
	const data = this.data
	// 计数
	for (let i = 0; i < autoList.length; i++) {
		const tiles = autoList[i].tiles
		for (let j = 0; j < tiles.length; j++) {
			const tile = tiles[j]

			if (typeof tile !== 'object') continue // 可能不是对象
			const template = tile.template
			if (!countMap[template]) countMap[template] = 0
			countMap[template]++
			break // 只需要计数一次
		}
	}
	// 显示
	for (let i = 0; i < data.length; i++) {
		const item = data[i]
		const count = countMap[item.id] || 0
		item.element.querySelector('.autoTile-count')?.remove()
		const countElem = document.createElement('span')
		countElem.className = 'autoTile-count'
		countElem.style =
			'color: var(--team-relation-mark-color-friend);padding:4px 2px;margin-left: 4px;'
		countElem.textContent = count
		item.element.append(countElem)
	}
}

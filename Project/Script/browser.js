'use strict'

// ******************************** 项目浏览器 ********************************

const Browser = $('#project-browser')
// properties
Browser.page = $('#project')
Browser.searcher = null
// 会话内搜索历史（不持久化，最多 9 条）
Browser.searchHistories = []
// methods
Browser.initialize = null
Browser.unselect = null
Browser.updateHead = null
Browser.openScript = null
Browser.createFile = null
Browser.createScript = null
Browser.updateNavVisibility = null
Browser.saveToProject = null
Browser.loadFromProject = null
// events
Browser.pageResize = null
Browser.bodyKeydown = null
Browser.bodyOpen = null
Browser.bodySelect = null
Browser.bodyUnselect = null
Browser.bodyPopup = null

// 初始化
Browser.initialize = function () {
	// 获取搜索框并添加按键过滤器
	this.searcher = this.links.head.searcher
	this.searcher.addKeydownFilter()

	// 侦听事件
	this.page.on('resize', this.pageResize)
	this.body.on('keydown', this.bodyKeydown)
	this.body.on('open', this.bodyOpen)
	this.body.on('select', this.bodySelect)
	this.body.on('unselect', this.bodyUnselect)
	this.body.on('popup', this.bodyPopup)

	// 搜索历史（会话内）：focus 显示历史，blur 保存当前关键词
	if (!this.searcher) {
		console.warn('Browser.initialize: searcher not found')
	} else {
		console.log('Browser.initialize: searcher bound', this.searcher)
		// 尝试找到内部真正的 input 元素（自定义 text-box 包裹）
		let searchInput = null
		try {
			searchInput = this.searcher.querySelector('.text-box-input') || this.searcher.querySelector('input')
		} catch (e) {
			searchInput = null
		}
		if (searchInput) {
			this.searcherInput = searchInput
			console.log('Browser.initialize: bound to inner input', searchInput)
			if (typeof searchInput.on === 'function') {
				searchInput.on('focus', this.searcherFocus)
				searchInput.on('blur', this.searcherBlur)
			} else if (typeof searchInput.addEventListener === 'function') {
				searchInput.addEventListener('focus', this.searcherFocus)
				searchInput.addEventListener('blur', this.searcherBlur)
			} else {
				console.warn('Browser.initialize: unable to bind focus/blur to inner input')
			}
		} else {
			// 退回绑定到自定义元素本身
			if (typeof this.searcher.on === 'function') {
				this.searcher.on('focus', this.searcherFocus)
				this.searcher.on('blur', this.searcherBlur)
			} else if (typeof this.searcher.addEventListener === 'function') {
				this.searcher.addEventListener('focus', this.searcherFocus)
				this.searcher.addEventListener('blur', this.searcherBlur)
			} else {
				console.warn('Browser.initialize: unable to bind focus/blur to searcher')
			}
		}
	}
	
	// 初始化全局主题监听器
	this._initThemeObserver()
}

// 取消选择元数据匹配的项目
Browser.unselect = function (meta) {
	const body = this.body
	const files = body.selections
	if (files.length === 1 && files[0].meta === meta) {
		body.unselect()
	}
}

// 更新头部位置
Browser.updateHead = function () {
	const { page, head } = this
	if (page.hasClass('visible')) {
		// 调整左边位置
		const { nav } = Layout.getGroupOfElement(head)
		const nRect = nav.rect()
		const iRect = nav.lastChild.rect()
		const left = iRect.right - nRect.left
		if (head.left !== left) {
			head.left = left
			head.style.left = `${left}px`
		}
		const bRect = this.body.rect()
		const padding = Math.max(bRect.left - iRect.right, 0)
		if (head.padding !== padding) {
			head.padding = padding
			head.style.paddingLeft = `${padding}px`
		}
	}
}

// 打开脚本文件
Browser.openScript = function (filePath) {
	const { mode, path } = Editor.config.scriptEditor
	switch (mode) {
		case 'by-file-extension':
			File.openPath(File.route(filePath))
			break
		case 'specified-application':
			if (path) {
				const args = [File.route(filePath)]
				require('child_process').spawn(path, args)
			}
			break
	}
}

// 创建文件
Browser.createFile = function (filename, data) {
	let guid
	do {
		guid = GUID.generate64bit()
	} while (Data.manifest.guidMap[guid])
	const { body } = this
	const [basename, extname] = filename.split('.')
	const fullname = `${basename}.${guid}.${extname}`
	const dirname = body.getDirName()
	const path = `${dirname}/${fullname}`
	const route = File.route(path)
	const json = data instanceof Object ? JSON.stringify(data, null, 2) : data
	FSP.writeFile(route, json)
		.then(() => {
			return Directory.update()
		})
		.then((changed) => {
			if (changed) {
				const folder = Directory.getFolder(dirname)
				if (folder.path === dirname) {
					this.nav.load(folder)
				}
				const file = Directory.getFile(path)
				if (file?.path === path) {
					body.select(file)
					body.rename(file)
				}
			}
			console.log(`write: ${path}`)
		})
		.catch((error) => {
			console.warn(error)
		})
}

// 创建脚本文件
Browser.createScript = function (filename) {
	let guid
	do {
		guid = GUID.generate64bit()
	} while (Data.manifest.guidMap[guid])
	const { body } = this
	const [basename, extname] = filename.split('.')
	const fullname = `${basename}.${guid}.${extname}`
	const dirname = body.getDirName()
	const path = `${dirname}/${fullname}`
	const route = File.route(path)
	const source = Path.resolve(TemplatesPath, 'script', filename)
	FSP.copyFile(source, route)
		.then(() => {
			return Directory.update()
		})
		.then((changed) => {
			if (changed) {
				const folder = Directory.getFolder(dirname)
				if (folder.path === dirname) {
					this.nav.load(folder)
				}
				const file = Directory.getFile(path)
				if (file?.path === path) {
					body.select(file)
					body.rename(file)
				}
			}
			console.log(`write: ${path}`)
		})
		.catch((error) => {
			console.warn(error)
		})
}

// 更新左侧栏的可见性
Browser.updateNavVisibility = function () {
	if (this.page.hasClass('visible')) {
		if (Browser.clientWidth >= 500) {
			if (this.removeClass('hide-nav-pane')) {
				this.nav.update()
			}
		} else {
			this.addClass('hide-nav-pane')
		}
	}
}

// 保存状态到项目文件
Browser.saveToProject = function (project) {
	const { browser } = project
	const { viewIndex } = this.body
	const selections = this.nav.getSelections()
	const folders = selections.map((folder) => folder.path)
	// 避免写入初始化错误造成的无效数据
	browser.view = viewIndex ?? browser.view
	if (folders.length !== 0) {
		browser.folders = folders
	}
}

// 从项目文件中加载状态
Browser.loadFromProject = function (project) {
	const { view, folders } = project.browser
	const selections = []
	for (const path of folders) {
		selections.append(Directory.getFolder(path))
	}
	if (selections.length === 0) {
		selections.append(Directory.assets)
	}
	this.directory = [Directory.assets]
	this.body.setViewIndex(view)
	this.nav.load(...selections)
}

// 页面 - 调整大小事件
Browser.pageResize = function (event) {
	Browser.updateNavVisibility()
	Browser.updateHead()
	Browser.nav.resize()
	Browser.body.computeGridProperties()
	Browser.body.resize()
	Browser.body.updateContentSize()
}

// 身体 - 键盘按下事件
Browser.bodyKeydown = function (event) {
	if (event.cmdOrCtrlKey) {
		switch (event.code) {
			case 'KeyX':
				this.copyFiles(true)
				break
			case 'KeyC':
				this.copyFiles()
				break
			case 'KeyV':
				this.pasteFiles()
				break
			default:
				return
		}
		event.stopImmediatePropagation()
	}
}

// 身体 - 打开文件
Browser.bodyOpen = function (event) {
	const file = event.value
	switch (file.type) {
		case 'scene':
		case 'ui':
		case 'animation':
		case 'particle':
			Title.openTab(file)
			break
		case 'event': {
			const item = file.data
			if (item) {
				EventEditor.openGlobalEvent(file.meta.guid)
			}
			break
		}
		case 'audio':
			Inspector.fileAudio.play()
			break
		case 'video':
			Inspector.fileVideo.play()
			break
		case 'script':
			Browser.openScript(file.path)
			break
		case 'other':
			File.openPath(File.route(file.path))
			break
	}
}

// 身体 - 选择事件
Browser.bodySelect = function (event) {
	const files = event.value
	if (files.length === 1 && files[0] instanceof FileItem) {
		const file = files[0]
		const meta = file.meta
		const type = file.type
		if (!meta) return
		switch (type) {
			case 'scene':
				break
			case 'ui':
				break
			case 'animation':
				break
			case 'particle':
				break
			case 'tileset':
				Inspector.open('fileTileset', file.data, meta)
				break
			case 'actor':
				Inspector.open('fileActor', file.data, meta)
				break
			case 'skill':
				Inspector.open('fileSkill', file.data, meta)
				break
			case 'trigger':
				Inspector.open('fileTrigger', file.data, meta)
				break
			case 'item':
				Inspector.open('fileItem', file.data, meta)
				break
			case 'equipment':
				Inspector.open('fileEquipment', file.data, meta)
				break
			case 'state':
				Inspector.open('fileState', file.data, meta)
				break
			case 'event':
				Inspector.open('fileEvent', file.data, meta)
				break
			case 'image':
				Inspector.open('fileImage', file, meta)
				break
			case 'audio':
				Inspector.open('fileAudio', file, meta)
				break
			case 'video':
				Inspector.open('fileVideo', file, meta)
				break
			case 'font':
				Inspector.open('fileFont', file, meta)
				break
			case 'script':
				Inspector.open('fileScript', file, meta)
				break
		}
	}
}

// 身体 - 取消选择事件
Browser.bodyUnselect = function (event) {
	if (Inspector.meta !== null) {
		const meta = Inspector.meta
		const files = event.value
		// meta有可能从映射表中删除，因此对比路径
		if (files.length === 1 && files[0].path === meta.path) {
			Inspector.close()
		}
	}
}

// 将搜索词加入会话历史（去重、最近优先、最多保留9条）
Browser.addSearchHistory = function (keyword) {
	if (!keyword) return
	const k = keyword.trim()
	if (!k) return
	const h = this.searchHistories
	const idx = h.indexOf(k)
	if (idx !== -1) h.splice(idx, 1)
	h.unshift(k)
	if (h.length > 9) h.length = 9
}

// 搜索框获得焦点：以下拉菜单显示历史
Browser.searcherFocus = function (event) {
	try {
		// 初始化主题监听器
		Browser._initThemeObserver()
		// 使用自定义 DOM 下拉以避免系统菜单夺取焦点
		Browser._showSearchHistoryDropdown(this)
	} catch (e) {
		console.error('Browser.searcherFocus error', e)
	}
}

// 搜索框失去焦点：保存当前搜索词到会话历史
Browser.searcherBlur = function (event) {
	try {
		const val = this.value
		if (val && val.trim()) {
			Browser.addSearchHistory(val)
			console.log('Browser.searcherBlur: added history', val)
		}
		// 延迟隐藏下拉，允许点击下拉项时处理点击事件
		setTimeout(() => {
			Browser._hideSearchHistoryDropdown()
		}, 150)
	} catch (e) {
		console.error('Browser.searcherBlur error', e)
	}
}

// 获取主题相关的样式
Browser._getThemeStyles = function () {
	const isDarkTheme = document.documentElement.classList.contains('dark')
	return {
		dropdown: {
			background: isDarkTheme ? '#383838' : '#f0f0f0',
			border: isDarkTheme ? '1px solid #181818' : '1px solid #c0c0c0',
			boxShadow: isDarkTheme ? '0 6px 18px rgba(0, 0, 0, 0.5)' : '0 6px 18px rgba(0, 0, 0, 0.15)',
			color: isDarkTheme ? '#d8d8d8' : '#000000',
		},
		item: {
			color: isDarkTheme ? '#d8d8d8' : '#000000',
			hoverBg: isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
		}
	}
}

// 初始化主题监听器
Browser._initThemeObserver = function () {
	if (this._themeObserver) return
	this._themeObserver = new MutationObserver(() => {
		if (this._searchDropdown) {
			const newThemeStyles = this._getThemeStyles()
			Object.assign(this._searchDropdown.style, {
				background: newThemeStyles.dropdown.background,
				border: newThemeStyles.dropdown.border,
				boxShadow: newThemeStyles.dropdown.boxShadow,
				color: newThemeStyles.dropdown.color,
			})
			// 更新下拉菜单项的样式
			const items = this._searchDropdown.querySelectorAll('.browser-search-item')
			items.forEach(item => {
				item.style.color = newThemeStyles.item.color
				item.style.background = ''
			})
		}
	})
	this._themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['class']
	})
}

// --- 自定义下拉实现（会话内） ---
Browser._createSearchDropdown = function () {
	if (this._searchDropdown) return
	const el = document.createElement('div')
	el.className = 'browser-search-history-dropdown'
	// 检查是否为黑暗主题
	const themeStyles = this._getThemeStyles()
	const styles = {
		position: 'absolute',
		zIndex: 9999,
		// 根据主题动态设置颜色
		background: themeStyles.dropdown.background,
		border: themeStyles.dropdown.border,
		boxShadow: themeStyles.dropdown.boxShadow,
		padding: '2px 0',
		maxHeight: '300px',
		maxWidth: '300px',
		overflowY: 'auto',
		overflowX: 'hidden',
		display: 'none',
		fontSize: '12px',
		color: themeStyles.dropdown.color,
		scrollbarWidth: 'none', // Firefox
	}
Object.assign(el.style, styles)
	
	// 初始化全局主题监听器
	this._initThemeObserver()
	
// 隐藏滚动条（Webkit）
el.style.setProperty('scrollbar-width', 'none') // Firefox
el.style.setProperty('msOverflowStyle', 'none') // IE/Edge
el.style.setProperty('overflow', 'auto')
el.style.setProperty('overflow-x', 'hidden')
el.style.setProperty('max-width', '300px')
el.style.setProperty('max-height', '300px')
// 伪元素隐藏滚动条（Webkit）
el.appendChild(document.createElement('style')).textContent = `
	.browser-search-history-dropdown::-webkit-scrollbar { display: none; width: 0; height: 0; }
`;
	// 阻止下拉上的 mousedown 导致输入框失去焦点
	el.addEventListener('mousedown', (e) => {
		e.preventDefault()
	})
	document.body.appendChild(el)
	this._searchDropdown = el
}

Browser._showSearchHistoryDropdown = function (inputEl) {
	try {
		this._createSearchDropdown()
		const el = this._searchDropdown
		const histories = this.searchHistories
		if (!histories || histories.length === 0) {
			el.style.display = 'none'
			return
		}
		// 清空并填充
		el.innerHTML = ''
		for (const kw of histories) {
			const item = document.createElement('div')
			item.className = 'browser-search-item'
			item.textContent = kw
			const themeStyles = this._getThemeStyles()
			Object.assign(item.style, {
				padding: '2px 8px',
				lineHeight: '17px',
				cursor: 'pointer',
				whiteSpace: 'nowrap',
				color: themeStyles.item.color,
				transition: 'background 0.2s ease'
			})
			item.addEventListener('click', (ev) => {
				inputEl.value = kw
				inputEl.dispatchEvent(new Event('input', { bubbles: true }))
				// 将焦点返回到输入框，随后隐藏下拉
				inputEl.focus()
				this._hideSearchHistoryDropdown()
			})
			item.addEventListener('mouseover', () => {
				const currentThemeStyles = this._getThemeStyles()
				item.style.background = currentThemeStyles.item.hoverBg
			})
			item.addEventListener('mouseout', () => {
				item.style.background = ''
			})
			el.appendChild(item)
		}
		// 定位
		const r = inputEl.getBoundingClientRect()
		el.style.minWidth = `${Math.max(r.width, 160)}px`
		el.style.left = `${r.left + window.scrollX}px`
		el.style.top = `${r.bottom + window.scrollY}px`
		el.style.display = 'block'
		// 监听外部点击以隐藏
		setTimeout(() => {
			this._outsideHandler = (ev) => {
				if (!el.contains(ev.target) && ev.target !== inputEl) {
					this._hideSearchHistoryDropdown()
				}
			}
			document.addEventListener('mousedown', this._outsideHandler)
		}, 0)
	} catch (e) {
		console.error('Browser._showSearchHistoryDropdown error', e)
	}
}

Browser._hideSearchHistoryDropdown = function () {
	try {
		const el = this._searchDropdown
		if (!el) return
		el.style.display = 'none'
		if (this._outsideHandler) {
			document.removeEventListener('mousedown', this._outsideHandler)
			this._outsideHandler = null
		}
	} catch (e) {
		console.error('Browser._hideSearchHistoryDropdown error', e)
	}
}

// 身体 - 菜单弹出事件
Browser.bodyPopup = function (event) {
	const items = []
	const { target } = event.raw
	const { browser, nav } = this.links
	const get = Local.createGetter('menuFileBrowser')
	const pastable = Clipboard.has('yami.files')
	let creatable = false
	if (target.seek('file-body-pane') === this) {
		const folders = nav.selections
		if (browser.display === 'normal' && folders.length === 1) {
			creatable = true
			items.push(
				{
					label: get(Local.showInExplorer()),
					click: () => {
						File.openPath(File.route(folders[0].path))
					}
				},
				{
					label: get('paste'),
					accelerator: ctrl('V'),
					enabled: pastable,
					click: () => {
						this.pasteFiles()
					}
				},
				{
					label: get('import'),
					click: () => {
						this.importFiles()
					}
				},
				{
					label: get('find-invalid-references'),
					click: () => {
						Reference.openInvalid()
					}
				},
				{
					label: get('find-unused-references'),
					click: () => {
						Reference.openUnused()
					}
				}
			)
		}
	} else {
		const element = target.seek('file-body-item', 2)
		if (
			element.tagName === 'FILE-BODY-ITEM' &&
			element.hasClass('selected')
		) {
			const { selections } = this
			const { file } = element
			const single = selections.length === 1
			if (single && selections[0] instanceof FolderItem) {
				creatable = true
			}
			// 如果选中的文件列表中不包含文件夹，则可以复制
			let copyable = true
			for (const file of selections) {
				if (file instanceof FolderItem) {
					copyable = false
					break
				}
			}
			items.push({
				label: get(Local.showInExplorer()),
				click: () => {
					this.showInExplorer()
				}
			})
			if (browser.display === 'search') {
				items.push({
					label: get('openFileLocation'),
					enabled: single,
					click: () => {
						this.openFileLocation(file)
					}
				})
			}
			items.push(
				{
					label: get('open'),
					accelerator: 'Enter',
					enabled: single,
					click: () => {
						this.openFile(file)
					}
				},
				{
					label: get('cut'),
					accelerator: ctrl('X'),
					enabled: copyable,
					click: () => {
						this.copyFiles(true)
					}
				},
				{
					label: get('copy'),
					accelerator: ctrl('C'),
					enabled: copyable,
					click: () => {
						this.copyFiles()
					}
				},
				{
					label: get('paste'),
					accelerator: ctrl('V'),
					enabled: pastable,
					click: () => {
						this.pasteFiles(
							creatable ? selections[0].path : undefined
						)
					}
				},
				{
					label: get('delete'),
					accelerator: 'Delete',
					enabled: !selections.includes(Directory.assets),
					click: () => {
						this.deleteFiles()
					}
				},
				{
					label: get('rename'),
					accelerator: 'F2',
					enabled: single && file !== Directory.assets,
					click: () => {
						this.rename(file)
					}
				},
				{
					label: get('export'),
					click: () => {
						this.exportFile()
					}
				}
			)
			if (single && file instanceof FileItem) {
				items.push(
					{
						label: get('copy-id'),
						click: () => {
							navigator.clipboard.writeText(file.meta.guid)
						}
					},
					{
						label: get('find-references'),
						accelerator: 'Alt+LB',
						click: () => {
							Reference.openRelated(file.meta.guid)
						}
					}
				)
			}
			if (file.type === 'script') {
				const { scriptEditor } = Editor.config
				let { mode, path } = scriptEditor
				if (path) path = Path.normalize(path)
				items.push({
					label: get('settings'),
					submenu: [
						{
							label: get('openByFileExtension'),
							checked: mode === 'by-file-extension',
							click: () => {
								if (mode !== 'by-file-extension') {
									scriptEditor.mode = 'by-file-extension'
									scriptEditor.path = ''
								}
							}
						},
						{
							label: path ? path : get('specifyTheScriptEditor'),
							checked: mode === 'specified-application',
							click: () => {
								File.showOpenDialog({
									title: 'Browse for application',
									defaultPath: path ? path : undefined,
									filters: [
										{
											name: 'Script Editor',
											extensions: ['exe']
										}
									]
								}).then(({ filePaths }) => {
									if (filePaths.length === 1) {
										scriptEditor.mode =
											'specified-application'
										scriptEditor.path = Path.slash(
											filePaths[0]
										)
									}
								})
							}
						}
					]
				})
			}
		}
	}
	if (items.length !== 0) {
		if (creatable) {
			items.unshift({
				label: get('create'),
				submenu: [
					{
						label: get('create.folder'),
						click: () => {
							this.createFolder()
						}
					},
					{
						label: get('create.actor'),
						click: () => {
							Browser.createFile(
								'Actor.actor',
								Inspector.fileActor.create()
							)
						}
					},
					{
						label: get('create.skill'),
						click: () => {
							Browser.createFile(
								'Skill.skill',
								Inspector.fileSkill.create()
							)
						}
					},
					{
						label: get('create.trigger'),
						click: () => {
							Browser.createFile(
								'Trigger.trigger',
								Inspector.fileTrigger.create()
							)
						}
					},
					{
						label: get('create.item'),
						click: () => {
							Browser.createFile(
								'Item.item',
								Inspector.fileItem.create()
							)
						}
					},
					{
						label: get('create.equipment'),
						click: () => {
							Browser.createFile(
								'Equipment.equip',
								Inspector.fileEquipment.create()
							)
						}
					},
					{
						label: get('create.state'),
						click: () => {
							Browser.createFile(
								'State.state',
								Inspector.fileState.create()
							)
						}
					},
					{
						label: get('create.scene'),
						click: () => {
							Browser.createFile(
								'Scene.scene',
								Inspector.fileScene.create()
							)
						}
					},
					{
						label: get('create.ui'),
						click: () => {
							Browser.createFile(
								'UI.ui',
								Inspector.fileUI.create()
							)
						}
					},
					{
						label: get('create.animation'),
						click: () => {
							Browser.createFile(
								'Animation.anim',
								Inspector.fileAnimation.create()
							)
						}
					},
					{
						label: get('create.particle'),
						click: () => {
							Browser.createFile(
								'Particle.particle',
								Inspector.fileParticle.create()
							)
						}
					},
					{
						label: get('create.normalTileset'),
						click: () => {
							Browser.createFile(
								'Tileset.tile',
								Inspector.fileTileset.create('normal')
							)
						}
					},
					{
						label: get('create.autoTileset'),
						click: () => {
							Browser.createFile(
								'Tileset.tile',
								Inspector.fileTileset.create('auto')
							)
						}
					},
					{
						label: get('create.event'),
						click: () => {
							Browser.createFile(
								'Event.event',
								Inspector.fileEvent.create('global')
							)
						}
					},
					{
						label: get('create.script'),
						submenu: [
							{
								label: get('create.script.global-command'),
								click: () => {
									Browser.createScript('GlobalCommand.ts')
								}
							},
							{
								label: get('create.script.global-plugin'),
								click: () => {
									Browser.createScript('GlobalPlugin.ts')
								}
							},
							{
								label: get('create.script.global-event'),
								click: () => {
									Browser.createScript('GlobalEvent.ts')
								}
							},
							{
								label: get('create.script.object-equipment'),
								click: () => {
									Browser.createScript('ObjectEquipment.ts')
								}
							},
							{
								label: get('create.script.object-item'),
								click: () => {
									Browser.createScript('ObjectItem.ts')
								}
							},
							{
								label: get('create.script.object-skill'),
								click: () => {
									Browser.createScript('ObjectSkill.ts')
								}
							},
							{
								label: get('create.script.object-state'),
								click: () => {
									Browser.createScript('ObjectState.ts')
								}
							},
							{
								label: get('create.script.scene'),
								click: () => {
									Browser.createScript('Scene.ts')
								}
							},
							{
								label: get('create.script.scene-actor'),
								click: () => {
									Browser.createScript('SceneActor.ts')
								}
							},
							{
								label: get('create.script.scene-trigger'),
								click: () => {
									Browser.createScript('SceneTrigger.ts')
								}
							},
							{
								label: get('create.script.scene-region'),
								click: () => {
									Browser.createScript('SceneRegion.ts')
								}
							},
							{
								label: get('create.script.scene-light'),
								click: () => {
									Browser.createScript('SceneLight.ts')
								}
							},
							{
								label: get('create.script.scene-animation'),
								click: () => {
									Browser.createScript('SceneAnimation.ts')
								}
							},
							{
								label: get('create.script.scene-particle'),
								click: () => {
									Browser.createScript('SceneParticle.ts')
								}
							},
							{
								label: get('create.script.scene-parallax'),
								click: () => {
									Browser.createScript('SceneParallax.ts')
								}
							},
							{
								label: get('create.script.scene-tilemap'),
								click: () => {
									Browser.createScript('SceneTilemap.ts')
								}
							},
							{
								label: get('create.script.ui-image'),
								click: () => {
									Browser.createScript('UIImage.ts')
								}
							},
							{
								label: get('create.script.ui-text'),
								click: () => {
									Browser.createScript('UIText.ts')
								}
							},
							{
								label: get('create.script.ui-textBox'),
								click: () => {
									Browser.createScript('UITextBox.ts')
								}
							},
							{
								label: get('create.script.ui-dialogBox'),
								click: () => {
									Browser.createScript('UIDialogBox.ts')
								}
							},
							{
								label: get('create.script.ui-progressBar'),
								click: () => {
									Browser.createScript('UIProgressBar.ts')
								}
							},
							{
								label: get('create.script.ui-button'),
								click: () => {
									Browser.createScript('UIButton.ts')
								}
							},
							{
								label: get('create.script.ui-animation'),
								click: () => {
									Browser.createScript('UIAnimation.ts')
								}
							},
							{
								label: get('create.script.ui-video'),
								click: () => {
									Browser.createScript('UIVideo.ts')
								}
							},
							{
								label: get('create.script.ui-window'),
								click: () => {
									Browser.createScript('UIWindow.ts')
								}
							},
							{
								label: get('create.script.ui-container'),
								click: () => {
									Browser.createScript('UIContainer.ts')
								}
							},
							{
								label: get('create.script.example'),
								click: () => {
									Browser.createScript('Example.ts')
								}
							}
						]
					}
				]
			})
		}
		Menu.popup(
			{
				x: event.clientX,
				y: event.clientY
			},
			items
		)
	}
}

// ******************************** 资源选择器 ********************************

const Selector = $('#selector-browser')
// properties
Selector.target = null
Selector.allowNone = true
Selector.audioPlayed = false
Selector.lastDir = 'Assets'
// methods
Selector.initialize = null
Selector.open = null
Selector.playAudio = null
Selector.saveToProject = null
Selector.loadFromProject = null
// events
Selector.windowClosed = null
Selector.windowResize = null
Selector.searcherKeydown = null
Selector.bodyKeydown = null
Selector.bodyOpen = null
Selector.bodyPopup = null
Selector.confirm = null

// 初始化
Selector.initialize = function () {
	// 因为不需要拖拽，覆盖body.activateFile事件
	this.body.activateFile = this.body.select

	// 设置搜索框ID接入语言包
	this.head.searcher.id = 'selector-search'

	// 侦听事件
	this.body.on('keydown', this.bodyKeydown)
	this.body.on('open', this.bodyOpen)
	this.body.on('popup', this.bodyPopup)
	this.head.searcher.on('keydown', this.searcherKeydown)
	$('#selector').on('closed', this.windowClosed)
	$('#selector').on('resize', this.windowResize)
	$('#selector-confirm').on('click', this.confirm)
}

// 打开窗口
Selector.open = function (target, allowNone = true) {
	this.target = target
	this.allowNone = allowNone
	Window.open('selector')

	const { nav, head, body } = this
	const guid = target.read()
	const meta = Data.manifest.guidMap[guid]
	const filter = target.filter
	this.filters = filter ? filter.split(' ') : null
	body.computeGridProperties()
	if (meta !== undefined) {
		const path = meta.path
		nav.load(Directory.getFolder(path))
		body.selectByPath(path)
	} else {
		nav.load(Directory.getFolder(this.lastDir))
	}
	head.searcher.getFocus()
}

// 播放音频
Selector.playAudio = function () {
	const files = this.links.body.selections
	if (files.length === 1 && files[0].type === 'audio') {
		this.audioPlayed = true
		AudioManager.player.stop()
		AudioManager.player.play(files[0].path)
	}
}

// 保存状态到项目文件
Selector.saveToProject = function (project) {
	const { selector } = project
	const { viewIndex } = this.body
	selector.view = viewIndex ?? selector.view
}

// 从项目文件中加载状态
Selector.loadFromProject = function (project) {
	const { view } = project.selector
	this.directory = [Directory.assets]
	this.body.setViewIndex(view)
}

// 窗口 - 已关闭事件
Selector.windowClosed = function (event) {
	const folder = Selector.nav.selections[0] ?? Selector.backupFolders[0]
	Selector.lastDir = folder ? folder.path : 'Assets'
	Selector.target = null
	Selector.restoreDisplay()
	Selector.nav.clear()
	Selector.head.address.clear()
	Selector.body.clear()
	// 停止播放预览中的声音
	if (Selector.audioPlayed) {
		Selector.audioPlayed = false
		AudioManager.player.stop()
	}
}

// 窗口 - 调整大小事件
Selector.windowResize = function (event) {
	Selector.nav.resize()
	Selector.body.computeGridProperties()
	Selector.body.resize()
	Selector.body.updateContentSize()
}

// 搜索框 - 键盘按下事件
Selector.searcherKeydown = function (event) {
	if (event.cmdOrCtrlKey) {
		return
	} else if (event.altKey) {
		return
	} else if (event.shiftKey) {
		return
	} else {
		switch (event.code) {
			case 'Tab':
				Selector.body.selectDefault()
				break
			case 'Enter':
			case 'NumpadEnter':
				if (this.read()) {
					event.stopImmediatePropagation()
					const { body } = Selector
					const { elements } = body
					if (elements.count === 1) {
						const { file } = elements[0]
						if (file instanceof FileItem) {
							body.select(file)
							Selector.confirm(event)
						}
					}
				}
				break
		}
	}
}

// 身体 - 键盘按下事件
Selector.bodyKeydown = function (event) {
	if (event.cmdOrCtrlKey) {
		return
	} else {
		switch (event.code) {
			case 'Space':
				Selector.playAudio()
				break
			default:
				return
		}
		event.stopImmediatePropagation()
	}
}

// 身体 - 打开事件
Selector.bodyOpen = function (event) {
	return Selector.confirm(event)
}

// 身体 - 菜单弹出事件
Selector.bodyPopup = function (event) {
	const items = []
	const { target } = event.raw
	const { browser, nav } = this.links
	const get = Local.createGetter('menuFileBrowser')
	if (target.seek('file-body-pane') === this) {
		const folders = nav.selections
		if (!(browser.display === 'normal' && folders.length === 1)) {
			return
		}
		items.push({
			label: get(Local.showInExplorer()),
			click: () => {
				File.openPath(File.route(folders[0].path))
			}
		})
	} else {
		const element = target.seek('file-body-item', 2)
		if (
			element.tagName === 'FILE-BODY-ITEM' &&
			element.hasClass('selected')
		) {
			const { selections } = this
			const { file } = element
			const single = selections.length === 1
			if (single && file.type === 'audio') {
				items.push({
					label: get('play'),
					accelerator: 'Space',
					click: () => {
						Selector.playAudio()
					}
				})
			}
			items.push({
				label: get(Local.showInExplorer()),
				click: () => {
					this.showInExplorer()
				}
			})
			if (browser.display === 'search') {
				items.push({
					label: get('openFileLocation'),
					enabled: single,
					click: () => {
						this.openFileLocation(file)
					}
				})
			}
			items.push(
				{
					label: get(file instanceof FolderItem ? 'open' : 'select'),
					accelerator: 'Enter',
					enabled: single,
					click: () => {
						this.openFile(file)
					}
				},
				{
					label: get('delete'),
					accelerator: 'Delete',
					enabled: !selections.includes(Directory.assets),
					click: () => {
						this.deleteFiles()
					}
				},
				{
					label: get('rename'),
					accelerator: 'F2',
					enabled: single && file !== Directory.assets,
					click: () => {
						this.rename(file)
					}
				},
				{
					label: get('export'),
					click: () => {
						this.exportFile()
					}
				}
			)
			if (single && file instanceof FileItem) {
				items.push(
					{
						label: get('copy-id'),
						click: () => {
							navigator.clipboard.writeText(file.meta.guid)
						}
					},
					{
						label: get('find-references'),
						accelerator: 'Alt+LB',
						click: () => {
							Reference.openRelated(file.meta.guid)
						}
					}
				)
			}
		}
	}
	if (items.length !== 0) {
		Menu.popup(
			{
				x: event.clientX,
				y: event.clientY
			},
			items
		)
	}
}

// 确定按钮 - 鼠标点击事件
Selector.confirm = function (event) {
	if (Selector.dragging) {
		return
	}
	const files = Selector.body.selections
	switch (files.length) {
		case 1:
			if (files[0] instanceof FileItem) {
				const file = files[0]
				const meta = file.meta
				if (meta !== undefined) {
					Selector.target.input(meta.guid)
					Window.close('selector')
				}
			}
			break
		case 0:
			if (Selector.allowNone) {
				Selector.target.input('')
				Window.close('selector')
			}
			break
	}
}

const ApkBuilder = new (class {
	logs = []
	constructor() {
		require('electron').ipcRenderer.on('apk-log', (_, log) => {
			this.logs.push(log)
			this.apkLog(log)
		})
	}
	build(cfg) {
		$('#export-apk-content').clear()
		const config = this.process(cfg)
		require('electron').ipcRenderer.invoke('build-apk', config)
	}
	apkLog(log) {
		const text = document.createElement('text')
		text.textContent = log.msg
		text.addClass('export-apk-major')
		$('#export-apk-content').appendChild(text)
		if (log.done) {
			$('#export-apk-button').enable()
		}
		$('#export-apk-container').scrollTo({
			top: $('#export-apk-container').scrollHeight
		})
	}
	reset() {
		$('#export-apk-content').clear()
		$('#export-apk-button').enable()
	}
	clearLog() {
		this.logs = []
	}
	stopBuild() {
		require('electron')
			.ipcRenderer.invoke('stop-build-apk')
			.then(() => {
				this.reset()
			})
	}
	isBuilding() {
		return require('electron').ipcRenderer.sendSync('isBuilding-apk')
	}
	processPathOnly(line) {
		const pathPrefix = Path.resolve(
			Path.dirname(Editor.config.project),
			'apk'
		)
		if (typeof line === 'string' && line?.startsWith('@')) {
			return Path.resolve(TemplatesPath, 'Apk', line.replace('@', '.'))
		} else if (typeof line === 'string' && line?.startsWith('$')) {
			return Path.resolve(pathPrefix, line.replace('$', '.'))
		} else if (typeof line === 'string' && line?.startsWith('~')) {
			return Path.resolve(
				Path.dirname(Editor.config.project),
				line.replace('~', '.')
			)
		}
		return line
	}
	process(cfg) {
		const config = JSON.parse(JSON.stringify(cfg))
		const list = Object.keys(config)
		list.forEach((v) => {
			config[v] = this.processPathOnly(config[v])
		})
		config.projectPath = Path.dirname(Editor.config.project)
		console.log(config)
		return config
	}
})()

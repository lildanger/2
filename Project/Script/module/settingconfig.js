const path = require('path')

const SettingConfig = new (class {
	config = {}
	homedir = GlobalPathForDir
	configPath = path.join(GlobalPath, 'yami-config.json')
	constructor() {
		$('#setting').on('open', this.open())
		$('#setting-confirm').on('click', () => {
			Window.close('setting')
		})
	}

	get defaultConfig() {
		return {
			server: {
				port: 5959,
				auto: false
			},
			apkbuild: {
				apkPath: '@/app-release.apk', // 原始APK路径
				outputDir: '$/decompiled', // 反编译输出目录
				newApkPath: '$/app-release-re.apk', // 新APK输出路径
				apktoolPath: '@/apktool.jar' // apktool.jar路径
			},
			signed: {
				isSign: true,
				jksPath: '@/release.jks', // JKS密钥库路径
				keyStorePassword: '123456', // 密钥库密码
				keyAlias: 'xuran', // 密钥别名
				keyPassword: '123456', // 密钥密码
				apksignerPath: '@/apksigner.bat', // apksigner路径
				zipalignPath: '@/zipalign.exe',
				signedApkPath: '$/app-debug-signed.apk' // 签名后APK路径
			},
			other: {
				copyAsTextKeepEmptyLine: true // 复制到文本 是否保留空行
			}
		}
	}
	open() {
		this.load()
		$('#setting').on('closed', () => {
			SettingConfig.close()
		})
		const InputEvent = (e, summary, name) => {
			if (Reflect.has(e.target, 'value'))
				SettingConfig.config[summary][name] = e.target.value
			else SettingConfig.config[summary][name] = e.value
		}
		// 本地服务
		$('#setting-server-port').on('input', (e) =>
			InputEvent(e, 'server', 'port')
		)
		$('#setting-server-auto').on('input', (e) =>
			InputEvent(e, 'server', 'auto')
		)
		// 反编译
		$('#setting-apkbuild-outputDir').on('input', (e) =>
			InputEvent(e, 'apkbuild', 'outputDir')
		)
		$('#setting-apkbuild-outputDir').on('mouseenter', (e) =>
			$('#setting-apkbuild-outputDir').setTooltip(
				ApkBuilder.processPathOnly(
					SettingConfig.config.apkbuild.outputDir
				)
			)
		)
		$('#setting-apkbuild-newApkPath').on('input', (e) =>
			InputEvent(e, 'apkbuild', 'newApkPath')
		)
		$('#setting-apkbuild-apktoolPath').on('mouseenter', (e) =>
			$('#setting-apkbuild-apktoolPath').setTooltip(
				ApkBuilder.processPathOnly(
					SettingConfig.config.apkbuild.apktoolPath
				)
			)
		)
		$('#setting-apkbuild-apktoolPath').on('input', (e) =>
			InputEvent(e, 'apkbuild', 'apktoolPath')
		)
		$('#setting-apkbuild-apktoolPath').on('mouseenter', (e) =>
			$('#setting-apkbuild-apktoolPath').setTooltip(
				ApkBuilder.processPathOnly(
					SettingConfig.config.apkbuild.apktoolPath
				)
			)
		)
		// 签名
		$('#setting-signed-jksPath').on('input', (e) =>
			InputEvent(e, 'signed', 'jksPath')
		)
		$('#setting-signed-jksPath').on('mouseenter', (e) =>
			$('#setting-signed-jksPath').setTooltip(
				ApkBuilder.processPathOnly(SettingConfig.config.signed.jksPath)
			)
		)
		$('#setting-signed-keyStorePassword').on('input', (e) =>
			InputEvent(e, 'signed', 'keyStorePassword')
		)
		$('#setting-signed-keyAlias').on('input', (e) =>
			InputEvent(e, 'signed', 'keyAlias')
		)
		$('#setting-signed-keyPassword').on('input', (e) =>
			InputEvent(e, 'signed', 'keyPassword')
		)
		$('#setting-signed-apksignerPath').on('input', (e) =>
			InputEvent(e, 'signed', 'apksignerPath')
		)
		$('#setting-signed-apksignerPath').on('mouseenter', (e) =>
			$('#setting-signed-apksignerPath').setTooltip(
				ApkBuilder.processPathOnly(
					SettingConfig.config.signed.apksignerPath
				)
			)
		)
		$('#setting-signed-zipalignPath').on('input', (e) =>
			InputEvent(e, 'signed', 'zipalignPath')
		)
		$('#setting-signed-zipalignPath').on('mouseenter', (e) =>
			$('#setting-signed-zipalignPath').setTooltip(
				ApkBuilder.processPathOnly(
					SettingConfig.config.signed.zipalignPath
				)
			)
		)
		$('#setting-signed-signedApkPath').on('input', (e) =>
			InputEvent(e, 'signed', 'signedApkPath')
		)
		$('#setting-signed-signedApkPath').on('mouseenter', (e) =>
			$('#setting-signed-signedApkPath').setTooltip(
				ApkBuilder.processPathOnly(
					SettingConfig.config.signed.signedApkPath
				)
			)
		)
		$('#setting-other-copyAsTextKeepEmptyLine').on('input', (e) =>
			InputEvent(e, 'other', 'copyAsTextKeepEmptyLine')
		)
		this.update()
	}
	close() {
		this.save()
	}
	load() {
		if (!fs.existsSync(this.configPath)) {
			fs.writeFileSync(
				this.configPath,
				JSON.stringify(this.defaultConfig),
				'utf-8'
			)
			this.config = JSON.parse(JSON.stringify(this.defaultConfig))
			return
		}
		this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'))
		// 比对，如果有新增字段，则合并
		const patch = (_p_obj, _t_obj) => {
			for (const key in _p_obj) {
				if (!Reflect.has(_t_obj, key)) {
					_t_obj[key] = _p_obj[key]
				}
				if (typeof _p_obj[key] === 'object') {
					_t_obj[key] = patch(_p_obj[key], _t_obj[key])
				}
			}
			return _t_obj
		}
		this.config = patch(this.defaultConfig, this.config)
	}
	update() {
		const write = getElementWriter('setting-server')
		write('port', this.config.server.port)
		write('auto', this.config.server.auto)
		const write2 = getElementWriter('setting-apkbuild')
		write2('outputDir', this.config.apkbuild.outputDir)
		write2('newApkPath', this.config.apkbuild.newApkPath)
		write2('apktoolPath', this.config.apkbuild.apktoolPath)
		const write3 = getElementWriter('setting-signed')
		write3('jksPath', this.config.signed.jksPath)
		write3('keyStorePassword', this.config.signed.keyStorePassword)
		write3('keyAlias', this.config.signed.keyAlias)
		write3('keyPassword', this.config.signed.keyPassword)
		write3('apksignerPath', this.config.signed.apksignerPath)
		write3('zipalignPath', this.config.signed.zipalignPath)
		write3('signedApkPath', this.config.signed.signedApkPath)
		const write4 = getElementWriter('setting-other')
		write4(
			'copyAsTextKeepEmptyLine',
			this.config.other.copyAsTextKeepEmptyLine
		)
	}
	save() {
		if (!fs.existsSync(this.configPath)) {
			return fs.writeFileSync(
				this.configPath,
				JSON.stringify(this.defaultConfig),
				'utf-8'
			)
		}
		fs.writeFileSync(this.configPath, JSON.stringify(this.config), 'utf-8')
		// 应用配置
		this.apply()
	}
	apply() {
		// server
		if (WebServer.port !== this.config.server.port) {
			WebServer.port = this.config.server.port
		}
	}
})()

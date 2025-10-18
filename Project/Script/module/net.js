const axios = require('axios')

const Net = new (class {
	get = axios.get
	post = axios.post
	cancelQueue = []

	constructor() {
		window.addEventListener('beforeunload', () => this.cancelAllDownloads())
	}

	async downloadFileWithProgress({
		url,
		outputPath,
		onProgress,
		onCancelToken,
		method = 'get'
	}) {
		const source = axios.CancelToken.source()

		this.cancelQueue.push(source)

		if (onCancelToken) {
			onCancelToken(() => source.cancel('用户主动取消下载'))
		}

		try {
			const response = await axios({
				method,
				url,
				responseType: 'blob',
				cancelToken: source.token,
				onDownloadProgress: (progressEvent) => {
					if (onProgress) {
						onProgress(progressEvent)
					}
				}
			})

			// 下载完成后从队列中移除
			this.cancelQueue = this.cancelQueue.filter(
				(item) => item !== source
			)

			if (outputPath) {
				const arrayBuffer = await response.data.arrayBuffer()
				const buffer = Buffer.from(arrayBuffer)
				return fs.writeFileSync(outputPath, buffer)
			} else {
				const arrayBuffer = await response.data.arrayBuffer()
				return Buffer.from(arrayBuffer)
			}
		} catch (err) {
			// 无论成功或失败都从队列中移除
			this.cancelQueue = this.cancelQueue.filter(
				(item) => item !== source
			)

			if (axios.isCancel(err)) {
				console.log('下载已取消：', err.message)
			} else {
				console.error('下载出错：', err)
			}
			throw err
		}
	}

	// 取消所有正在进行的下载
	cancelAllDownloads() {
		this.cancelQueue.forEach((source) => {
			source.cancel('取消所有下载')
		})
		this.cancelQueue = [] // 清空队列
	}
})()

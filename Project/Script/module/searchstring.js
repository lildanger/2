const SearchString = new (class {
	window = $('#event-search-string')
	current = null
	log = $('#event-search-string-log')
	lastArr = []
	index = 0
	searchMode = { caseInsensitive: false, regex: false, matchLine: false }
	constructor() {
		this.window.on('keydown', (e) => {
			if (e.key == 'Enter' && this.lastArr.length > 0) {
				this.next()
			}
		})
		$('#event-search-string').on('closed', () => this.close())
		$('#event-search-string-previous').on('click', () => this.previous())
		$('#event-search-string-next').on('click', () => this.next())
		$('#event-search-string-search').on('input', (e) => this.input(e))
		$('#event-search-string-case-insensitive').on('change', (e) =>
			this.change('caseInsensitive', e)
		)
		$('#event-search-string-regex').on('change', (e) =>
			this.change('regex', e)
		)
		$('#event-search-string-match-line').on('change', (e) =>
			this.change('matchLine', e)
		)
	}
	change(mode, e) {
		this.searchMode[mode] = e.target.read()
		switch (mode) {
			case 'caseInsensitive':
				if (this.searchMode[mode]) {
					$('#event-search-string-regex').write(false)
					$('#event-search-string-regex').disable()
				} else {
					$('#event-search-string-regex').enable()
				}
				break
			case 'regex':
				if (this.searchMode[mode]) {
					$('#event-search-string-case-insensitive').write(false)
					$('#event-search-string-case-insensitive').disable()
				} else {
					$('#event-search-string-case-insensitive').enable()
				}
				break
		}
		if ($('#event-search-string-search').read())
			this.input({
				target: { value: $('#event-search-string-search').read() }
			})
	}
	locationLine() {
		// 滚动到指定行
		const arr = this.lastArr
		if (arr.length == 0) return
		const index = this.index
		const current = arr[index]
		current.node.classList.add('event-search-string-location-active')
		this.current.scrollToRow(current.index)
		if (current.sub) {
			if (current.sub?.folded) {
				this.current.fold(current.sub)
			}
		}
	}
	clear() {
		this.lastArr.forEach((element) => {
			element.node.classList.remove('event-search-string-location-active')
			element.node.classList.remove('event-search-string-active')
		})
	}
	clearHistory() {
		$('#event-search-string-search').write('')
	}
	input(e) {
		const val = e.target.value
		if (val.trim() == '') {
			this.clear()
			this.lastArr = []
			this.log.textContent = this.lastArr.length
			return
		}
		this.clear()
		const { elements } = this.current
		const findArr = this.current.findString(val, elements, this.searchMode)
		this.lastArr = findArr
		findArr.forEach((element) => {
			element.node.classList.add('event-search-string-active')
		})
		this.log.textContent = findArr.length
		if (this.lastArr.length == 0) {
			$('#event-search-string-previous').disable()
			$('#event-search-string-next').disable()
		} else {
			$('#event-search-string-previous').enable()
			$('#event-search-string-next').enable()
		}
	}
	clearCurrentHighlight() {
		const arr = this.lastArr
		const index = this.index
		const currentNode = arr[index]
		currentNode.node.classList.remove('event-search-string-location-active')
	}
	previous() {
		if (this.lastArr.length == 0) return
		// 移除上一个高亮
		this.clearCurrentHighlight()
		this.index--
		if (this.index < 0) {
			this.index = this.lastArr.length - 1
		}
		this.locationLine()
	}
	next() {
		if (this.lastArr.length == 0) return
		// 移除上一个高亮
		this.clearCurrentHighlight()
		this.index++
		if (this.index >= this.lastArr.length) {
			this.index = 0
		}
		this.locationLine()
	}

	open(eventWindow) {
		Window.open('event-search-string')
		this.index = 0
		this.current = eventWindow
		$('#event-search-string-previous').disable()
		$('#event-search-string-next').disable()
		$('#event-search-string-search').focus()
		if ($('#event-search-string-search').read())
			this.input({
				target: { value: $('#event-search-string-search').read() }
			})
	}
	close() {
		this.current = null
		this.clear()
		this.lastArr = []
		this.log.textContent = this.lastArr.length
	}
})()

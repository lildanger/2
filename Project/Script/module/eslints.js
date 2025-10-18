'use strict'

/* 辅助线 */

const updateCommandElement = CommandList.prototype.updateCommandElement
CommandList.prototype.updateCommandElement = function (element) {
	const ret = updateCommandElement.call(this, ...arguments)

	element.querySelectorAll('command-mark-major').forEach((e) => {
		e.remove()
	})

	element.querySelectorAll('command-mark-minor').forEach((e) => {
		e.remove()
	})

	// 创建前缀
	let pre = document.createElement('command-mark-major')
	pre.textContent = ''
	element.insertBefore(pre, element.firstElementChild)
	element.pre = pre

	//创建辅助线
	element.lines = []
	for (let i = element.dataIndent; i >= 0; i--) {
		let line = document.createElement('command-line')
		line.style.marginLeft = this.computeTextIndent(i)
		element.insertBefore(line, element.firstElementChild)
		element.lines[i] = line
	}

	// 辅助线 hover 状态
	const list = this.elements
	if (!element?.eventBinding) {
		element.on('mouseenter', function () {
			let indent = null
			const { start, end } = range(
				list,
				list.findIndex((v) => v === element)
			)
			for (let i = start; i <= end; i++) {
				const element = list[i]
				if (indent === null) {
					indent = element.dataIndent
				}
				const needNode = element.lines?.[indent]
				if (needNode && needNode.mark !== 'header')
					needNode.classList.add('hover')
			}
		})
		element.on('mouseleave', function () {
			let indent = null
			const { start, end } = range(
				list,
				list.findIndex((v) => v === element)
			)
			for (let i = start; i <= end; i++) {
				const element = list[i]
				if (indent === null) {
					indent = element.dataIndent
				}
				const needNode = element.lines?.[indent]
				if (needNode && needNode.mark !== 'header')
					needNode.classList.remove('hover')
			}
		})
		element.eventBinding = true
	}

	return ret
}

const commandList = document.querySelector('#event-commands')

commandList.getSelectionPosition = function () {
	return this.elements[this.active].pre.getBoundingClientRect()
}

/* 获取区域 */
function range(elements, start, end = start) {
	// 限制范围
	const count = elements.count
	start = Math.clamp(start, 0, count - 1)
	end = Math.clamp(end, 0, count - 1)
	let indent = Infinity
	for (let i = start; i <= end; i++) {
		const { dataIndent } = elements[i]
		if (dataIndent < indent) {
			indent = dataIndent
		}
	}
	for (let i = start; i >= 0; i--) {
		const element = elements[i]
		if (element.dataIndent === indent && element.dataKey === true) {
			start = i
			break
		}
	}
	for (let i = end + 1; i < count; i++) {
		const element = elements[i]
		if (
			element.dataIndent < indent ||
			(element.dataIndent === indent && element.dataKey === true)
		) {
			end = i - 1
			break
		}
	}
	if (start !== end) {
		const element = elements[end]
		if (!element.dataItem) {
			end--
		}
	}
	return {
		start,
		end,
		indent
	}
}

commandList.on('update', function () {
	const list = this.elements
	for (let i = 0; i < list.count; i++) {
		const e = list[i]
		if (e.fold) {
			e.mark = 'header'
		} else {
			e.mark = 'item'
			const buffer = e.dataItem?.buffer
			if (buffer && buffer.length > 1) {
				e.mark = 'option'
				if (buffer[buffer.length - 1] == e) {
					e.mark = 'footer'
				}
			}
		}
		e.classList.add(e.mark)
	}
})

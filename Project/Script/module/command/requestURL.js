const RequestkeyValueBind = {
	target: null,
	type: null,
	initialize() {
		this.target = null
		this.type = 'request-header'
		// 侦听事件
		$('#request-keyValue-confirm').on('click', this.confirm)
	},
	parse(i) {
		return `${typeof i.key === 'string' ? i.key : i.key.key} = ${typeof i.value === 'string' ? i.value : i.value.key}`
	},
	open(item) {
		Window.open('request-keyValue')
		if (!item) {
			$('#request-keyValue-value').write('')
			$('#request-keyValue-key').write('')
			$('#request-keyValue-key').getFocus()
		} else {
			$('#request-keyValue-value').write(item.value)
			$('#request-keyValue-key').write(item.key)
			$('#request-keyValue-key').getFocus()
		}
	},
	save() {
		const read = getElementReader('request-keyValue')
		const data = { key: read('key'), value: read('value') }
		const headers = this.target.read()
		if (headers.some((item) => item.key === data.key)) {
			// 覆盖重复的键值
			headers.splice(
				headers.findIndex((item) => item.key === data.key),
				1,
				data
			)
		}
		if (!data.key) {
			return $('#request-keyValue-key').getFocus()
		}
		Window.close('request-keyValue')
		return data
	},
	confirm() {
		return RequestkeyValueBind.target.save()
	}
}

// 请求RequestURL
Command.cases.requestURL = {
	initialize: function () {
		$('#requestURL-method').loadItems([
			{ name: 'GET', value: 'GET' },
			{ name: 'POST', value: 'POST' },
			{ name: 'PUT', value: 'PUT' },
			{ name: 'DELETE', value: 'DELETE' }
		])
		$('#requestURL-method').write('GET')
		$('#requestURL-url').write('')
		$('#requestURL-header').bind(RequestkeyValueBind)
		$('#requestURL-data').bind(RequestkeyValueBind)
		$('#requestURL-confirm').on('click', this.save)
	},
	parse: function ({
		url = '',
		method = 'GET',
		headers = [],
		data = [],
		callback = ''
	}) {
		const head = [
			{ color: 'network' },
			{ text: Local.get('command.requestURL') },
			{ text: ' , ' },
			{ color: 'normal' },
			{
				text:
					typeof url === 'string'
						? url
						: Command.parseVariable(url, 'any')
			},
			{ text: ' , ' },
			{ text: method },
			{ text: ' , ' },
			{ text: callback },
			{ text: ' -> ' }
		]
		const contents = []
		for (const i of headers) {
			contents.push(
				{ text: ' , ' },
				{ color: 'normal' },
				{
					text: `${typeof i.key === 'string' ? i.key : Command.parseVariable(i.key, 'any')} = ${typeof i.value === 'string' ? i.value : Command.parseVariable(i.value, 'any')}`
				}
			)
		}
		const datas = []
		for (const i of data) {
			datas.push(
				{ text: ' , ' },
				{ color: 'normal' },
				{
					text: `${typeof i.key === 'string' ? i.key : Command.parseVariable(i.key, 'any')} = ${typeof i.value === 'string' ? i.value : Command.parseVariable(i.value, 'any')}`
				}
			)
		}
		return head.concat(
			contents.slice(1),
			{ text: `, ${Local.get('command.requestURLData')} = ` },
			datas.slice(1)
		)
	},
	load: function ({
		url = '',
		method = 'GET',
		headers = [],
		data = [],
		callback = ''
	}) {
		$('#requestURL-method').write(method)
		$('#requestURL-callback').write(callback)
		$('#requestURL-url').write(url)
		$('#requestURL-url').getFocus()
		const write = getElementWriter('requestURL')
		write('header', headers)
		write('data', data)
	},
	save: function () {
		const elVariable = $('#requestURL-url')
		const variable = elVariable.read()
		if (!variable || VariableGetter.isNone(variable)) {
			return elVariable.getFocus()
		}
		const read = getElementReader('requestURL')
		Command.save({
			url: variable,
			method: read('method'),
			headers: read('header'),
			data: read('data'),
			callback: read('callback')
		})
	}
}

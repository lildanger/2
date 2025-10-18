const EventBus = new (class EventBus {
	events
	constructor() {
		this.events = {}
	}

	on(eventName, callback) {
		if (!this.events[eventName]) {
			this.events[eventName] = []
		}
		this.events[eventName].push(callback)

		return () => {
			this.off(eventName, callback)
		}
	}

	off(eventName, callback) {
		if (!this.events[eventName]) return

		this.events[eventName] = this.events[eventName].filter(
			(cb) => cb !== callback
		)

		if (this.events[eventName].length === 0) {
			delete this.events[eventName]
		}
	}

	emit(eventName, data) {
		if (!this.events[eventName]) return

		const callbacks = [...this.events[eventName]]

		callbacks.forEach((callback) => {
			try {
				callback(data)
			} catch (err) {
				console.error(`Error in event handler for ${eventName}:`, err)
			}
		})
	}

	once(eventName, callback) {
		const wrapper = (data) => {
			callback(data)
			this.off(eventName, wrapper)
		}

		this.on(eventName, wrapper)

		return () => {
			this.off(eventName, wrapper)
		}
	}

	clear() {
		this.events = {}
	}
})()

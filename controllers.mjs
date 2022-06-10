export class ContextController {
    constructor(host, options = {}) {
        (this.host = host).addController(this)
        this.options = options
        this.contexts = Object.fromEntries(Object.entries(this.host.constructor.properties || {})
            .filter(([, {context}]) => context))
    }

    fetchContext(property, options = {}) {
        if (typeof process === 'object') return this.getServerContext(property) || options.fallback;
        let context
        const init = {
            bubbles: true, composed: true, detail: {property, callback: result => (context = result), ...options}
        }
        if (options.listen && !options.listener) init.detail.listener = () => this.host.requestUpdate()
        if (this.host.parentElement && this.host.parentElement.dispatchEvent)
            this.host.parentElement.dispatchEvent(new CustomEvent('context', init))
        return context || options.fallback
    }

    getServerContext(property, stack = globalThis.renderInfo.customElementInstanceStack) {
        return [...stack].reverse().reduce((context, {element} = {}) => {
            if (context) return context;
            if (element.context && element.context.resolveContext)
                return element.context.resolveContext(property, {skipProxy: true})
        }, undefined)
    }

    resolveContext(property, {skipProxy} = {}) {
        if (this.host[property] && (this.options.anyProperty || this.contexts[property])) return this.host[property]
        if (!skipProxy) return this.fetchContext(property)
    }

    contextEventHandler(event) {
        if (event.detail && event.detail.property && event.detail.callback) {
            event.stopImmediatePropagation();
            event.preventDefault();
            event.detail.callback(this.resolveContext(event.detail.property));
            if (event.detail.listener) this.addListener(event.detail.property, event.detail.listener)
        }
    }

    addListener(property, listener) {
        if (!this.contexts[property]) this.contexts[property] = {}
        if (!this.contexts[property].listeners) this.contexts[property].listeners = new Set()
        this.contexts[property].listeners.add(listener)
    }

    hostUpdated() {
        Object.entries(this.contexts).forEach(([property, options]) =>
            options.listeners ? options.listeners.forEach(f => f(this.host[property])) : null)
    }

    hostConnected() {
        this.host.addEventListener('context', this.contextEventHandler.bind(this))
    }

    hostDisconnected() {
        this.host.removeEventListener('context', this.contextEventHandler.bind(this))
    }
}

import {readFileSync} from "fs";
import EventEmitter from "events";
import {Generator} from "@jspm/generator";
import {imports, resetImports} from "./loader.mjs";
import {readableFrom} from "@svalit/ssr/lib/readable.js";
import {render} from "@svalit/ssr/lib/render-with-global-dom-shim.js";

const defaultClientLoader = readFileSync(new URL('client.mjs', import.meta.url))

export default class RenderThread {
    html = ''
    meta = {}
    chunks = []
    renderEvents = new EventEmitter()
    renderingPromise = Promise.resolve()
    importMapOptions = {inputMap: {imports: {'#root/': './'}}}

    constructor({meta = {}, dev = false, importMapOptions = {}, headContent, footerContent, clientLoader} = {}) {
        Object.assign(this.meta, meta)
        Object.assign(this.importMapOptions, importMapOptions)
        this.clientLoader = clientLoader || defaultClientLoader
        Object.assign(this, {dev, headContent, footerContent})
        this.renderEvents.once('meta', this.metaHandler.bind(this))
        this.meta.setMeta = data => this.renderEvents.emit('meta', data)
        this.importMapGenerator = new Generator(Object.assign({env: this.env}, this.importMapOptions))
    }

    get env() {
        return [this.dev ? 'development' : 'production', 'browser', 'module']
    }

    async renderTemplate(template) {
        globalThis.renderInfo = {customElementHostStack: [], customElementInstanceStack: []}
        this.stream = readableFrom(render(template(this), globalThis.renderInfo), true)
        this.stream.on('end', () => this.renderingPromise = this.streamHandler.call(this))
        for await (let chunk of this.stream) this.chunks.push(Buffer.from(chunk))
        await this.renderingPromise
        return this.html
    }

    async streamHandler() {
        this.renderEvents.emit('meta', {})
        const footer = await this.importMapGenerator.htmlGenerate(this.footerTemplate())
        const html = Buffer.concat(this.chunks) + this.shimScripts(footer)
        resetImports()
        return this.html = html
    }

    metaHandler({title = this.meta.title, status = 200} = {}) {
        if (title) this.meta.title = title;
        if (status) this.meta.status = status;
        this.chunks.unshift(Buffer.from(this.headTemplate()))
    }

    headTemplate({title = 'SvaLit'} = this.meta) {
        return [
            `<!doctype html><html lang="en"><head>`,
            this.headContent,
            `<title>${title}</title>`,
            `</head><body>`
        ].filter(Boolean).join('\n')
    }

    footerTemplate(meta = this.meta) {
        return [
            this.scriptTemplate(JSON.stringify({"shimMode": true}), {type: 'esms-options'}),
            this.scriptTemplate(JSON.stringify(this.importMapOptions.inputMap || {}), {type: "importmap"}),
            Object.keys(imports) ? this.scriptTemplate(`window.imports=${JSON.stringify(Object.keys(imports))}`) : null,
            this.scriptTemplate(`window.env=${JSON.stringify(this.env)}`),
            this.scriptTemplate(`window.meta=${JSON.stringify(meta)}`),
            this.scriptTemplate(this.clientLoader, {type: "module", defer: null}),
            this.importsTemplate(imports),
            this.footerContent,
            `</body></html>`
        ].filter(Boolean).join('\n')
    }

    importsTemplate(imports = [], attributes = {type: "module", defer: null}) {
        const importTemplate = (url) => `import '${url.startsWith('/') ? ('#root' + url) : url}';`
        return Object.keys(imports).map(url => this.scriptTemplate(importTemplate(url), attributes)).join('\n')
    }

    scriptTemplate(source = '', attributes = {}) {
        const attributesString = Object.entries(attributes).length ?
            ' ' + Object.entries(attributes).map(([k, v]) => k + (v ? `="${v}"` : '')).join(' ') : ''
        return `<script${attributesString}>${source}</script>`
    }

    shimScripts(source) {
        return source.replaceAll('type="importmap"', 'type="importmap-shim"').replaceAll('type="module"', 'type="module-shim"')
    }
}

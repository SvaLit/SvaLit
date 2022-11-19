import {readFileSync} from "fs";
import EventEmitter from "events";
import {Generator} from "@jspm/generator";
import {resetImports, exportImports} from "./loader.mjs";
import {readableFrom} from "@lit-async/ssr/lib/readable.js";
import {render} from "@lit-async/ssr/lib/render-with-global-dom-shim.js";

const clientLoader = readFileSync(new URL('client.mjs', import.meta.url))

export class RenderThread {
    html = ''
    meta = {}
    shim = {}
    chunks = []
    generationOptions = {}
    content = {loader: clientLoader}
    renderEvents = new EventEmitter()
    renderingPromise = Promise.resolve()
    importMapOptions = {inputMap: {imports: {'#root/': './'}}}

    constructor({dev, shim = {}, meta = {}, content = {}, importMapOptions = {}, generationOptions = {}} = {}) {
        Object.assign(this.meta, meta)
        Object.assign(this.shim, shim)
        Object.assign(this, {dev})
        Object.assign(this.content, content)
        Object.assign(this.importMapOptions, importMapOptions)
        Object.assign(this.generationOptions, generationOptions)
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
        const footer = this.importMapOptions.disableGeneration ? this.footerTemplate() :
            await this.importMapGenerator.htmlGenerate(this.footerTemplate(), this.generationOptions)
        const updatedFooter = this.disableImports(footer).replace(`"./": {`, `"/": {`)
        const html = Buffer.concat(this.chunks) + this.shimScripts(updatedFooter)
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
            this.content.head,
            `<title>${title}</title>`,
            `</head><body>`
        ].filter(Boolean).join('\n')
    }

    footerTemplate(meta = this.meta) {
        return [
            this.scriptTemplate(JSON.stringify(this.shim), {type: 'esms-options'}),
            this.scriptTemplate(JSON.stringify(this.importMapOptions.inputMap || {}, null, 4), {type: "importmap"}),
            this.scriptTemplate(`window.resolutions=${JSON.stringify(this.importMapOptions.resolutions || {})}`),
            this.scriptTemplate(`window.imports=${JSON.stringify(exportImports())}`),
            this.scriptTemplate(`window.env=${JSON.stringify(this.env)}`),
            this.scriptTemplate(`window.meta=${JSON.stringify(meta)}`),
            this.scriptTemplate(this.content.loader, {type: "module", defer: null}),
            this.importsTemplate(exportImports()),
            this.content.footer,
            `</body></html>`
        ].filter(Boolean).join('\n')
    }

    importsTemplate(imports = exportImports(), attributes = {type: "module", import: null, defer: null}) {
        if (this.importMapOptions.disableGeneration) return
        const importTemplate = (url) => `import '${url.startsWith('/') ? ('#root' + url) : url}';`
        return imports.map(url => this.scriptTemplate(importTemplate(url), attributes)).join('\n')
    }

    scriptTemplate(source = '', attributes = {}) {
        const attributesString = Object.entries(attributes).length ?
            ' ' + Object.entries(attributes).map(([k, v]) => k + (v ? `="${v}"` : '')).join(' ') : ''
        return `<script${attributesString}>${source}</script>`
    }

    shimScripts(source) {
        if (!this.shim.shimMode) return source
        return source.replaceAll('type="importmap"', 'type="importmap-shim"').replaceAll('type="module"', 'type="module-shim"')
    }

    disableImports(source) {
        return source.replaceAll('type="module" import', 'type="module-disabled"')
    }
}

export {render, readableFrom}
export default RenderThread

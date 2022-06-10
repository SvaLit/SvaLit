import {readFileSync} from "fs";
import EventEmitter from "events";
import {Generator} from "@jspm/generator";
import {imports, resetImports} from "./loader.mjs";
import {readableFrom} from "@svalit/ssr/lib/readable.js";
import {render} from "@svalit/ssr/lib/render-with-global-dom-shim.js";

const scriptTemplate = (source, attributes = {}) =>
        `<script ${Object.entries(attributes).map(([k, v]) => k + (v ? `="${v}"` : '')).join(' ')}>${source}</script>`,
    clientLoader = readFileSync(new URL('client.mjs', import.meta.url))

export default class RenderThread {
    chunks = []

    constructor({
                    req,
                    res,
                    importMap,
                    headContent,
                    footerContent,
                    env = false,
                    isDev = false,
                    meta = {title: 'SvaLit'},
                    renderEvents = new EventEmitter(),
                    root = new URL('./', import.meta.url).href
                } = {}) {
        globalThis.renderInfo = {customElementHostStack: [], customElementInstanceStack: []}
        globalThis.env = this.env = env || [isDev ? 'development' : 'production', 'browser', 'module']
        Object.assign(this, {req, res, root, meta, isDev, importMap, headContent, footerContent, renderEvents})
        this.importMapGenerator = new Generator({rootUrl: root, cache: isDev, env: this.env})
        this.renderEvents.once('meta', this.metaHandler.bind(this))
    }

    async renderTemplate(template = () => `Hello SvaLit!`) {
        this.output = Promise.resolve()
        this.meta.setMeta = data => this.renderEvents.emit('meta', data || {})
        this.stream = readableFrom(render(template(this), globalThis.renderInfo), true)
        this.stream.on('end', () => this.output = this.streamHandler.call(this))
        for await (let chunk of this.stream) this.chunks.push(Buffer.from(chunk))
        return await this.output
    }

    async streamHandler() {
        this.renderEvents.emit('meta', {})
        const html = Buffer.concat(this.chunks) + this.footerTemplate()
        resetImports()
        const output = (await this.importMapGenerator.htmlGenerate(html))
            .replaceAll('type="importmap"', 'type="importmap-shim"').replaceAll('type="module"', 'type="module-shim"')
        return this?.res?.end(output) || output
    }

    metaHandler({title = this.meta.title, status = 200} = {}) {
        this.chunks.unshift(Buffer.from(this.headTemplate(title)))
        if (status) this.meta.status = status;
        if (title) this.meta.title = title;
    }

    headTemplate(title = 'LCMS') {
        return [
            `<!doctype html><html lang="ru"><head>`,
            this.headContent,
            scriptTemplate(JSON.stringify({"shimMode": true}), {type: 'esms-options'}),
            `<script type="importmap">${JSON.stringify(this.importMap || {})}</script>`,
            `<title>${title}</title>`,
            `</head><body>`
        ].filter(Boolean).join('\n')
    }

    footerTemplate(meta = this.meta) {
        const importScriptAttributes = {type: "module", defer: null}
        const importTemplate = (url) => `import '${url.startsWith('/') ? ('#root' + url) : url}';`
        return [
            Object.keys(imports) ? scriptTemplate(`window.imports=${JSON.stringify(Object.keys(imports))}`) : null,
            scriptTemplate(`window.env=${JSON.stringify(globalThis.env)}`),
            scriptTemplate(`window.meta=${JSON.stringify(meta)}`),
            scriptTemplate(clientLoader, importScriptAttributes),
            this.footerContent,
            Object.keys(imports).map(url => scriptTemplate(importTemplate(url), importScriptAttributes)).join('\n'),
            `</body></html>`
        ].filter(Boolean).join('\n')
    }
}

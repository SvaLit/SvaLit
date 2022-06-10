const appBase = typeof process === 'object' ? process.env.PWD : location.origin
const env = globalThis.env || ['production', 'browser', 'module']
const api = 'https://api.jspm.io/generate'

export let imports = {}

export const resetImports = () => imports = {}

export function syncImport(path, base = appBase) {
    let url = path;
    let id = path;
    if (path.startsWith('/') || path.startsWith('.')) try {
        url = new URL(path, base).href
        id = url.split(appBase).pop()
    } catch (e) {
        console.error(e)
    }
    if (imports[id]) return imports[id]
    if (typeof process !== 'object') {
        try {
            import.meta.resolve(url)
        } catch (e) {
            const importMapURL = `${api}?install=${url}&env=${env.join(',')}`
            return fetch(importMapURL).then(r => r.json()).then(({map}) =>
                document.head.appendChild(Object.assign(document.createElement('script'), {
                    type: 'importmap-shim',
                    innerHTML: JSON.stringify(map)
                }))).then(() => import(url)).then(module => imports[id] = module)
        }
    }
    return import(url).then(module => imports[id] = module)
}

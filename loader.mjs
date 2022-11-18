const appBase = typeof process === 'object' ? process.env.PWD : location.origin
const getImportMap = () => globalThis?.importShim?.getImportMap() || {}
const envs = globalThis.env || ['production', 'browser', 'module']
const overrides = globalThis.resolutions || {}
const api = 'https://api.jspm.io/generate'

export let imports = {}

export const resetImports = () => imports = {}

export function cleanMap({imports = {}, scopes = {}} = {}) {
    const localhost = new URL('/', location).href;
    const isValid = value => !value.startsWith('#') && !value.startsWith(localhost);
    const filter = target => Object.fromEntries(Object.entries(target).filter(([key, value]) => isValid(key) && isValid(value)));
    const filterScopes = target => Object.fromEntries(Object.entries(target).filter(([key]) => isValid(key)).map(([key, value]) => [key, filter(value)]))
    return {imports: filter(imports), scopes: filterScopes(scopes)}
}

export async function fetchImportMap(install, importMap = getImportMap(), resolutions = overrides, env = envs) {
    const options = {
        method: 'post',
        body: JSON.stringify({install, env, resolutions, inputMap: cleanMap(importMap)})
    }
    const {map = {}} = await fetch(api, options)
        .then(response => response.json())
        .catch(e => console.error(e));
    return map;
}

export function appendImportMap(map) {
    return document.head.appendChild(Object.assign(document.createElement('script'), {
        innerHTML: JSON.stringify(map),
        type: 'importmap-shim'
    }))
}

export function syncImport(path, base = appBase) {
    let url = path;
    let id = path;
    if (isURL(path)) try {
        url = new URL(path, base).href
        id = url.split(appBase).pop()
    } catch (e) {
        console.error(e)
    }
    if (imports[id]) return imports[id]
    if (typeof process !== 'object' && !isURL(url)) {
        try {
            import.meta.resolve(url)
        } catch (e) {
            return fetchImportMap(url)
                .then(appendImportMap)
                .then(() => import(url))
                .then(module => imports[id] = module)
        }
    }
    return import(url).then(module => imports[id] = module)
}

export const exportImports = () => Object.keys(imports)

const isURL = str => str.startsWith('http://') || str.startsWith('https://') || str.startsWith('/') || str.startsWith('.')

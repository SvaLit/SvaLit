import {writeFile, mkdir} from 'fs/promises'
import RenderThread from "./render.mjs"

export const render = ({
                           renderOptions = {},
                           publicDir = './',
                           template = () => 'SvaLit',
                           renderClass = RenderThread,
                           origin = 'http://localhost',
                           routes = [{path: '/'}]
                       } = {}) =>
    Promise.all(routes.map(({path, template: tpl = template, ...options}) =>
        new renderClass({
            ...renderOptions,
            ...options,
            meta: {url: new URL(path, origin)}
        }).renderTemplate(tpl).then((html, targetPath = new URL(convertPath(path), publicDir)) =>
            mkdir(new URL('./', targetPath)).catch(e => console.error(e)).then(() => writeFile(targetPath, html).catch(e => console.error(e)))).then(() => path)))

export const convertPath = path => (path.startsWith('/') ? '.' : '') +
    (path.endsWith('/') ? (path + 'index.html') : (path.endsWith('.html') ? path : (path + '/index.html')))

export default render

import RenderThread from "../render.mjs"
import template from './template.mjs'
import handler from 'serve-handler'
import {readFileSync} from "fs";
import {send} from 'es-micro'
import Router from 'router'

const packageData = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)).toString()),
    templateModule = readFileSync(new URL('template.mjs', import.meta.url)),
    options = {
        dev: true,
        meta: {title: 'Svalit Demo'},
        importMapOptions: {resolutions: packageData?.overrides, rootUrl: new URL('../', import.meta.url)},
        content: {footer: `<script type="module" defer>${templateModule}</script>`}
    }

const router = Router()
    .get('/', async (req, res) => {
        const thread = new RenderThread(options) //.renderTemplate(template)
        return send(res, 200, await thread.renderTemplate(template))
    })

export default (req, res) => router(req, res, () => handler(req, res))

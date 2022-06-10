import RenderThread from "../index.mjs"
import template from './template.mjs'
import handler from 'serve-handler'
import {readFileSync} from "fs";
import {send} from 'es-micro'
import Router from 'router'

const options = {
    dev: true,
    meta: {title: 'Svalit Demo'},
    importMapOptions: {
        // ignore: ["svalit"],
        // inputMap: {imports: {'#svalit/': './'}},
        // rootUrl: new URL('../', import.meta.url),
        // mapUrl: new URL('../', import.meta.url),
        // baseUrl: new URL('../', import.meta.url),
        // resolutions: {'#svalit': new URL('../', import.meta.url)}
    },
    footerContent: `<script type="module" defer>${readFileSync(new URL('template.mjs', import.meta.url))}</script>`
}

const router = Router()
    .get('/', async (req, res) => {
        const thread = new RenderThread(options) //.renderTemplate(template)
        return send(res, 200, await thread.renderTemplate(template))
    })

export default (req, res) => router(req, res, () => handler(req, res))

import RenderThread from "../render.mjs"
import template from './template.mjs'
import handler from 'serve-handler'
import {readFileSync} from "fs";
import {send} from 'es-micro'
import Router from 'router'

const options = {
    dev: true,
    meta: {title: 'Svalit Demo'},
    content: {footer: `<script type="module" defer>${readFileSync(new URL('template.mjs', import.meta.url))}</script>`}
}

const router = Router()
    .get('/', async (req, res) => {
        const thread = new RenderThread(options) //.renderTemplate(template)
        return send(res, 200, await thread.renderTemplate(template))
    })

export default (req, res) => router(req, res, () => handler(req, res))

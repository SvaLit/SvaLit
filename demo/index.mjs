import RenderThread from "../index.mjs"
import template from './template.mjs'
import handler from 'serve-handler'
import {readFileSync} from "fs";
import {send} from 'es-micro'
import Router from 'router'

const options = {
    isDev: true,
    meta: {title: 'Svalit Demo'},
    root: new URL('../', import.meta.url).href,
    footerContent: `<script type="module" defer>${readFileSync(new URL('template.mjs', import.meta.url))}</script>`
}

const router = Router()
    .get('/', async (req, res) => send(res, 200, await new RenderThread(options).renderTemplate(template)))

export default (req, res) => router(req, res, () => handler(req, res))

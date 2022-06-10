import 'lit/experimental-hydrate-support.js'
import {syncImport} from 'svalit/loader.mjs'
import {hydrateShadowRoots} from '@webcomponents/template-shadowroot'

if (!HTMLTemplateElement.prototype.hasOwnProperty('shadowRoot')) hydrateShadowRoots(document.body)

if (window.imports) await Promise.all(window.imports.map((url) => syncImport(url)))

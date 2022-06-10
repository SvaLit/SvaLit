import {until} from 'lit/directives/until.js';
import {serverUntil} from "@svalit/ssr-client/directives/server-until.js";

const targetUntil = typeof process === 'object' ? serverUntil : until;

export const syncUntil = (p, ...args) => p instanceof Promise ? targetUntil(p, ...args) : p;

export class SafeUntil {
    constructor(host) {
        (this.host = host).addController(this)
        return this.safeUntil.bind(this.host)
    }

    safeUntil(p, ...args) {
        if (p instanceof Promise && typeof process !== 'object' && !this.hasUpdated) {
            console.error('Async hydration in', this)
            return syncUntil(undefined, ...args)
        }
        return syncUntil(p, ...args)
    }
}

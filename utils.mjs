export const chain = (...f) => f.reduce((r, f) => r instanceof Promise ? r.then(f) : f(r))

export const all = (a = []) => a.some(p => p instanceof Promise) ? Promise.all(a) : a

export const catcher = (t, h) => {
    if (t instanceof Promise) return t.catch(h)
    try {
        return t instanceof Function ? t() : t
    } catch (e) {
        return h instanceof Function ? h(e) : h
    }
}

// The old manual Push/Pull sync is replaced by automatic Google-account sync
// (see cloud.js). These stubs only exist so MakanLedger.jsx still imports cleanly.
export function pushState() { return Promise.reject(new Error("Use the account button to sync.")); }
export function pullState() { return Promise.reject(new Error("Use the account button to sync.")); }

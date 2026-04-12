/** Callback set by BillsProvider so notification actions can refresh dashboard state */
let reloadHandler = async () => {};

export function registerBillsReload(handler) {
  reloadHandler =
    handler == null ? async () => {} : handler;
}

export async function requestBillsReload() {
  try {
    await reloadHandler();
  } catch {
    // ignore
  }
}

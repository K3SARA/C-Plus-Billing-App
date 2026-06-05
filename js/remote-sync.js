(function () {
  const db = window.db;
  if (!db) return;

  const SYNC_KEY = 'cplus_remote_snapshot_updated_at';
  const DEFAULT_API_BASE = '/api';
  const configuredBase = (window.CPLUS_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, '');
  const mutatingMethods = [
    'addProduct',
    'addInventoryLog',
    'updateProduct',
    'deleteProduct',
    'deductStock',
    'addBackStock',
    'cancelBillAndReturnStock',
    'saveBillWithStockAndCollectionLog',
    'collectBillPaymentAtomic',
    'updateBillWithStockAndCollectionLog',
    'updateCustomer',
    'renameCustomerInBills',
    'addCustomer',
    'deleteCustomer',
    'upsertCustomerByName',
    'deleteBillAndReturnStock',
    'updateBill',
    'deleteBill',
    'addCollectionLog',
    'deleteCollectionLog',
    'addExpense',
    'updateExpense',
    'deleteExpense',
    'addAuditLog',
    'saveCollectingOrder',
    'deleteCollectingOrder',
    'saveSetting',
    'clearImportRollback',
    'importAllData'
  ];

  let enabled = false;
  let checked = false;
  let paused = false;
  let timer = null;
  let syncing = false;
  let pending = false;

  function localSyncedTime() {
    return Number(localStorage.getItem(SYNC_KEY) || '0') || 0;
  }

  function setLocalSyncedTime(value) {
    const time = Date.parse(value || '') || Date.now();
    localStorage.setItem(SYNC_KEY, String(time));
  }

  async function request(path, options = {}) {
    const response = await fetch(`${configuredBase}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `Remote sync failed with status ${response.status}`);
    }
    return response.json();
  }

  function countRows(payload) {
    const data = payload?.data || {};
    return [
      'products',
      'customers',
      'bills',
      'collectingOrders',
      'collectionLogs',
      'inventoryLogs',
      'expenses',
      'auditLogs'
    ].reduce((sum, key) => sum + (Array.isArray(data[key]) ? data[key].length : 0), 0);
  }

  async function checkRemote() {
    if (checked) return enabled;
    checked = true;
    try {
      const health = await request('/health');
      enabled = Boolean(health?.ok);
    } catch (error) {
      enabled = false;
      console.info('Remote sync unavailable; using browser database only.');
    }
    return enabled;
  }

  async function pullLatest() {
    if (!(await checkRemote())) return false;

    const snapshot = await request('/snapshot');
    if (!snapshot?.exists || !snapshot.payload) return false;

    const remoteTime = Date.parse(snapshot.updatedAt || '') || 0;
    const localTime = localSyncedTime();
    const localPayload = await db.exportAllData();
    const localHasRows = countRows(localPayload) > 0;

    if (!localHasRows || !localTime || remoteTime > localTime) {
      paused = true;
      try {
        await db.importAllData(snapshot.payload);
        setLocalSyncedTime(snapshot.updatedAt);
      } finally {
        paused = false;
      }
      return true;
    }

    return false;
  }

  async function pushNow(reason = 'manual') {
    if (paused || !(await checkRemote())) return false;
    if (syncing) {
      pending = true;
      return false;
    }

    syncing = true;
    try {
      const payload = await db.exportAllData();
      if (countRows(payload) === 0) return false;

      const result = await request('/snapshot', {
        method: 'PUT',
        body: JSON.stringify({ payload, reason })
      });
      if (result?.updatedAt) setLocalSyncedTime(result.updatedAt);
      return true;
    } catch (error) {
      console.warn('Remote sync failed:', error.message || error);
      return false;
    } finally {
      syncing = false;
      if (pending) {
        pending = false;
        schedulePush('queued');
      }
    }
  }

  function schedulePush(reason) {
    if (paused) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      pushNow(reason);
    }, 350);
  }

  const originalInit = db.init.bind(db);
  db.init = async function (...args) {
    const result = await originalInit(...args);
    if (await checkRemote()) {
      const pulled = await pullLatest();
      if (!pulled) {
        const snapshot = await request('/snapshot').catch(() => null);
        if (!snapshot?.exists) schedulePush('initial-seed');
      }
    }
    return result;
  };

  mutatingMethods.forEach((methodName) => {
    if (typeof db[methodName] !== 'function') return;
    const original = db[methodName].bind(db);
    db[methodName] = async function (...args) {
      const result = await original(...args);
      if (!paused) schedulePush(methodName);
      return result;
    };
  });

  window.remoteSync = {
    check: checkRemote,
    pullLatest,
    pushNow,
    isEnabled: () => enabled
  };
})();

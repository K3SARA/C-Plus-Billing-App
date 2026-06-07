class App {
  constructor() {
    this.currentPage = 'login';
    this.isReady = false;
    this.sideMenuExpanded = false;
    this.sideMenuTouched = false;
    this.deferredInstallPrompt = null;
  }

  async init() {
    try {
      await window.db.init();
      await window.db.syncCustomersFromBills();
      // Ensure a starter tech-shop item exists for fresh installs.
      const prods = await window.db.getProducts();
      if (prods.length === 0) {
        await window.db.addProduct('USB-C Cable', 10, 1500, 900, 3);
      }
    } catch (e) {
      console.error('DB Init error', e);
      alert(`App failed to start. ${e?.message || e || 'Please refresh and try again.'}`);
      return;
    }
    
    window.auth.init();
    if (window.billing) await window.billing.init();
    if (window.historyView) window.historyView.init();
    if (window.inventory) await window.inventory.init();
    if (window.customersPage) window.customersPage.init();
    if (window.collectionPage) window.collectionPage.init();
    if (window.reportsView) window.reportsView.init();
    if (window.expensesPage) window.expensesPage.init();
    if (window.clearInputs) window.clearInputs.init();
    this.bindSideMenu();
    this.bindNumberInputWheelGuard();
    this.bindPwaInstaller();
    this.bindBackupButtons();
    this.updateBackupReminder();
    this.isReady = true;
    if (window.auth && typeof window.auth.setReadyState === 'function') {
      window.auth.setReadyState(true);
    }

    if (!window.auth?.isAuthenticated) {
      this.navigate('login');
    }
  }

  navigate(pageId) {
    if (pageId !== 'login' && window.auth && !window.auth.isAuthenticated) {
      pageId = 'login';
    }

    if (pageId === 'login') {
      this.clearLoginBlockers();
    }

    document.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });
    const page = document.getElementById(`${pageId}-page`);
    if (page) {
      page.classList.add('active');
      this.currentPage = pageId;

      if (!this.isWideLayout()) this.sideMenuExpanded = false;
      this.syncSideMenuVisibility(pageId);
      
      // Sync side nav
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
      });
      const navItem = document.getElementById(`nav-${pageId}`);
      if (navItem) navItem.classList.add('active');

      if (pageId === 'history' && window.historyView) {
        window.historyView.render();
      }
      if (pageId === 'inventory' && window.inventory) {
        window.inventory.render();
      }
      if (pageId === 'customers' && window.customersPage) {
        window.customersPage.render();
      }
      if (pageId === 'collection' && window.collectionPage) {
        window.collectionPage.render();
      }
      if (pageId === 'reports' && window.reportsView) {
        window.reportsView.render();
      }
      if (pageId === 'expenses' && window.expensesPage) {
        window.expensesPage.render();
      }
      if (pageId === 'billing') {
        this.updateBackupReminder();
        if (window.billing) {
          window.billing.refreshProducts();
          window.billing.loadCustomerDirectory();
          window.billing.loadOutstandingDirectory();
        }
      }
    }
  }

  bindSideMenu() {
    const toggle = document.getElementById('side-menu-toggle');
    const backdrop = document.getElementById('side-menu-backdrop');

    if (toggle && toggle.dataset.bound !== '1') {
      toggle.dataset.bound = '1';
      toggle.addEventListener('click', () => this.toggleSideMenu());
    }

    if (backdrop && backdrop.dataset.bound !== '1') {
      backdrop.dataset.bound = '1';
      backdrop.addEventListener('click', () => this.closeSideMenu());
    }

    if (!this.sideMenuResizeBound) {
      this.sideMenuResizeBound = true;
      window.addEventListener('resize', () => {
        if (!this.sideMenuTouched) this.sideMenuExpanded = this.isWideLayout();
        this.syncSideMenuVisibility(this.currentPage);
      });
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') this.closeSideMenu();
      });
    }
  }

  bindNumberInputWheelGuard() {
    if (this.numberWheelGuardBound) return;
    this.numberWheelGuardBound = true;

    document.addEventListener('wheel', (event) => {
      const input = event.target?.closest?.('input[type="number"]');
      if (!input || document.activeElement !== input) return;

      event.preventDefault();
    }, { capture: true, passive: false });
  }

  bindPwaInstaller() {
    if (this.pwaInstallerBound) return;
    this.pwaInstallerBound = true;

    document.querySelectorAll('.js-install-app').forEach((button) => {
      if (button.dataset.installBound === '1') return;
      button.dataset.installBound = '1';
      button.addEventListener('click', () => this.installPwa());
    });

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferredInstallPrompt = event;
      this.updateInstallButtons();
    });

    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = null;
      this.updateInstallButtons();
    });

    this.updateInstallButtons();
  }

  updateInstallButtons() {
    const showInstall = !this.isStandalonePwa()
      && (Boolean(this.deferredInstallPrompt) || this.isIosDevice());

    document.querySelectorAll('.js-install-app').forEach((button) => {
      button.classList.toggle('hidden', !showInstall);
    });
  }

  async installPwa() {
    if (this.isStandalonePwa()) {
      this.updateInstallButtons();
      return;
    }

    if (this.deferredInstallPrompt) {
      const promptEvent = this.deferredInstallPrompt;
      this.deferredInstallPrompt = null;
      promptEvent.prompt();

      try {
        await promptEvent.userChoice;
      } catch (error) {
        console.warn('PWA install prompt finished without a choice.', error);
      }

      this.updateInstallButtons();
      return;
    }

    if (this.isIosDevice()) {
      alert('To install on iPhone or iPad, tap Share, then Add to Home Screen.');
    }
  }

  isWideLayout() {
    return window.matchMedia('(min-width: 901px)').matches;
  }

  toggleSideMenu() {
    this.sideMenuTouched = true;
    this.sideMenuExpanded = !this.sideMenuExpanded;
    this.syncSideMenuVisibility(this.currentPage);
  }

  closeSideMenu() {
    if (!this.sideMenuExpanded) return;
    this.sideMenuTouched = true;
    this.sideMenuExpanded = false;
    this.syncSideMenuVisibility(this.currentPage);
  }

  syncSideMenuVisibility(pageId = this.currentPage) {
    const showMenu = pageId !== 'login' && (!window.auth || window.auth.isAuthenticated);
    const sideNav = document.getElementById('side-nav');
    const toggle = document.getElementById('side-menu-toggle');
    const backdrop = document.getElementById('side-menu-backdrop');

    if (!this.sideMenuTouched && showMenu) {
      this.sideMenuExpanded = this.isWideLayout();
    }

    sideNav?.classList.toggle('hidden', !showMenu);
    toggle?.classList.toggle('hidden', !showMenu);
    document.body.classList.toggle('side-menu-ready', showMenu);
    document.body.classList.toggle('side-menu-expanded', showMenu && this.sideMenuExpanded);

    if (sideNav) {
      sideNav.classList.toggle('is-expanded', showMenu && this.sideMenuExpanded);
      sideNav.classList.toggle('is-collapsed', showMenu && !this.sideMenuExpanded);
    }

    if (toggle) {
      toggle.setAttribute('aria-expanded', String(showMenu && this.sideMenuExpanded));
    }

    const showBackdrop = showMenu && this.sideMenuExpanded && !this.isWideLayout();
    backdrop?.classList.toggle('hidden', !showBackdrop);
    backdrop?.classList.toggle('active', showBackdrop);
  }

  clearLoginBlockers() {
    document.querySelectorAll('.modal-overlay.active').forEach(modal => {
      modal.classList.remove('active');
    });

    const backdrop = document.getElementById('side-menu-backdrop');
    const sideNav = document.getElementById('side-nav');
    const toggle = document.getElementById('side-menu-toggle');

    backdrop?.classList.add('hidden');
    backdrop?.classList.remove('active');
    sideNav?.classList.add('hidden');
    sideNav?.classList.remove('is-expanded', 'is-collapsed');
    toggle?.classList.add('hidden');
    toggle?.setAttribute('aria-expanded', 'false');

    document.body.classList.remove('side-menu-ready', 'side-menu-expanded');
    this.sideMenuExpanded = false;
  }

  bindBackupButtons() {
    ['btn-quick-backup', 'btn-reminder-backup'].forEach((id) => {
      const btn = document.getElementById(id);
      if (!btn || btn.dataset.backupBound === '1') return;
      btn.dataset.backupBound = '1';
      btn.addEventListener('click', () => this.exportBackup('manual'));
    });
  }

  getLastBackupTime() {
    return Number(localStorage.getItem('last_backup_at') || '0') || 0;
  }

  updateBackupReminder() {
    const reminder = document.getElementById('backup-reminder');
    const text = document.getElementById('backup-reminder-text');
    if (!reminder || !text) return;

    const last = this.getLastBackupTime();
    const ageMs = Date.now() - last;
    const due = !last || ageMs > 24 * 60 * 60 * 1000;
    reminder.classList.toggle('hidden', !due);

    if (!last) {
      text.textContent = 'No backup created yet. Create one before using the app heavily.';
      return;
    }

    const lastText = new Date(last).toLocaleString();
    text.textContent = `Last backup: ${lastText}. Create a fresh backup daily.`;
  }

  isIosDevice() {
    const ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua)
      || (navigator.platform === 'MacIntel' && Number(navigator.maxTouchPoints || 0) > 1);
  }

  isStandalonePwa() {
    return Boolean(window.navigator.standalone)
      || window.matchMedia?.('(display-mode: standalone)')?.matches;
  }

  canShareBackupFile(file) {
    return Boolean(
      navigator.share
      && navigator.canShare
      && navigator.canShare({ files: [file] })
    );
  }

  async shareBackupFile(file) {
    await navigator.share({
      files: [file],
      title: 'C Plus Tech Billing Backup',
      text: 'Save this backup JSON file to Files or share it to a safe location.'
    });
  }

  downloadBackupBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  confirmBackupSaved(reason) {
    if (reason === 'before_import') return true;
    if (!this.isIosDevice() && !this.isStandalonePwa()) return true;
    return confirm('Backup file was prepared. Confirm only after you saved the backup file to Files or Downloads.');
  }

  async markBackupExported(reason) {
    localStorage.setItem('last_backup_at', String(Date.now()));
    await window.db.addAuditLog({
      action: 'backup_export',
      entity: 'backup',
      details: { reason }
    });
    this.updateBackupReminder();
  }

  async exportBackup(reason = 'manual') {
    try {
      const payload = await window.db.exportAllData();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `billing-backup-${date}.json`;
      const file = typeof File === 'function'
        ? new File([blob], fileName, { type: 'application/json' })
        : null;
      const preferShare = this.isIosDevice() || this.isStandalonePwa();

      if (file && preferShare && this.canShareBackupFile(file)) {
        await this.shareBackupFile(file);
      } else {
        this.downloadBackupBlob(blob, fileName);
      }

      if (!this.confirmBackupSaved(reason)) return false;

      await this.markBackupExported(reason);
      return true;
    } catch (err) {
      if (err?.name === 'AbortError') return false;
      alert('Backup export failed.');
      console.error(err);
      return false;
    }
  }

  openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
  }

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
  }

  logout() {
    const confirmed = confirm('Log out now?');
    if (!confirmed) return;

    if (window.auth) {
      window.auth.logout();
    }

    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.classList.remove('active');
    });
    document.getElementById('auth-pass').value = '';
    this.navigate('login');
  }
}

window.app = new App();

document.addEventListener('DOMContentLoaded', () => {
  window.app.init();
  
  // Close modals when clicking overlay
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
});

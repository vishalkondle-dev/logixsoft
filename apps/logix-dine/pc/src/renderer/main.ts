const pc = window.logixDinePC;

async function initRenderer() {
  console.log('[Logix Dine PC] Initializing Desktop Renderer...');

  if (!pc) {
    console.warn('[Logix Dine PC] Preload bridge not detected (running in standard browser)');
    return;
  }

  // Load App Info
  try {
    const info = await pc.getAppInfo();
    const platformEl = document.getElementById('info-platform');
    const archEl = document.getElementById('info-arch');
    const electronEl = document.getElementById('info-electron');
    const engineEl = document.getElementById('info-engine');

    if (platformEl) platformEl.textContent = `${info.platform.toUpperCase()} (${info.name} v${info.version})`;
    if (archEl) archEl.textContent = info.arch;
    if (electronEl) electronEl.textContent = `v${info.versions.electron}`;
    if (engineEl) engineEl.textContent = `Cr ${info.versions.chrome} / Node ${info.versions.node}`;
  } catch (e) {
    console.error('Failed to load app info:', e);
  }

  // Load Printers
  try {
    const printers = await pc.getPrinters();
    const selectEl = document.getElementById('printer-select') as HTMLSelectElement;
    if (selectEl && Array.isArray(printers)) {
      printers.forEach((p: any) => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.textContent = `${p.name} ${p.isDefault ? '(Default)' : ''}`;
        selectEl.appendChild(opt);
      });
    }
  } catch (e) {
    console.error('Failed to load printers:', e);
  }

  // Load Saved Config
  try {
    const savedServerUrl = await pc.getConfig('serverUrl');
    const savedAutoPrint = await pc.getConfig('autoPrintReceipt');
    const urlInput = document.getElementById('server-url-input') as HTMLInputElement;
    const silentCheck = document.getElementById('silent-print-checkbox') as HTMLInputElement;

    if (urlInput && savedServerUrl) urlInput.value = savedServerUrl;
    if (silentCheck && typeof savedAutoPrint === 'boolean') silentCheck.checked = savedAutoPrint;

    silentCheck?.addEventListener('change', () => {
      pc.setConfig('autoPrintReceipt', silentCheck.checked);
    });
  } catch (e) {
    console.error('Failed to load config:', e);
  }

  // Wire Server URL Buttons
  const urlInput = document.getElementById('server-url-input') as HTMLInputElement;
  const connectBtn = document.getElementById('btn-connect');
  const presetCloud = document.getElementById('preset-cloud');
  const presetLocal = document.getElementById('preset-local');

  const connectToUrl = async (url: string) => {
    if (!url) return;
    await pc.setConfig('serverUrl', url);
    window.location.href = url;
  };

  connectBtn?.addEventListener('click', () => {
    connectToUrl(urlInput.value);
  });

  presetCloud?.addEventListener('click', () => {
    urlInput.value = 'https://dine.logixsoft.in';
    connectToUrl(urlInput.value);
  });

  presetLocal?.addEventListener('click', () => {
    urlInput.value = 'http://localhost:3000';
    connectToUrl(urlInput.value);
  });

  // Wire Kiosk Button
  const kioskBtn = document.getElementById('btn-toggle-kiosk');
  kioskBtn?.addEventListener('click', async () => {
    const isNowKiosk = await pc.toggleKiosk();
    if (kioskBtn) {
      kioskBtn.textContent = isNowKiosk ? 'Exit Kiosk Mode (F11)' : 'Toggle Kiosk Mode (F11)';
    }
  });

  // Wire Test Print Receipt Button
  const testPrintBtn = document.getElementById('btn-test-print');
  testPrintBtn?.addEventListener('click', async () => {
    const printerSelect = document.getElementById('printer-select') as HTMLSelectElement;
    const silentCheck = document.getElementById('silent-print-checkbox') as HTMLInputElement;

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: monospace;
              width: 280px;
              margin: 0 auto;
              padding: 10px;
              font-size: 12px;
              color: black;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed black; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 16px;">LOGIX DINE</div>
          <div class="center">Modern Restaurant OS</div>
          <div class="center">GSTIN: 27AABCL1234F1Z1</div>
          <div class="divider"></div>
          <div class="row"><span>Table: 04</span><span>Server: Waiter #1</span></div>
          <div class="row"><span>Bill No: #DINE-8821</span><span>Date: ${new Date().toLocaleDateString()}</span></div>
          <div class="divider"></div>
          <div class="row bold"><span>Item</span><span>Qty x Rate</span><span>Amount</span></div>
          <div class="divider"></div>
          <div class="row"><span>Paneer Tikka</span><span>2 x 220</span><span>440.00</span></div>
          <div class="row"><span>Butter Naan</span><span>4 x 40</span><span>160.00</span></div>
          <div class="row"><span>Dal Makhani</span><span>1 x 280</span><span>280.00</span></div>
          <div class="divider"></div>
          <div class="row"><span>Subtotal:</span><span>880.00</span></div>
          <div class="row"><span>CGST (2.5%):</span><span>22.00</span></div>
          <div class="row"><span>SGST (2.5%):</span><span>22.00</span></div>
          <div class="divider"></div>
          <div class="row bold" style="font-size: 14px;"><span>GRAND TOTAL:</span><span>₹924.00</span></div>
          <div class="divider"></div>
          <div class="center">*** TEST PRINT SUCCESSFUL ***</div>
          <div class="center">Thank you for dining with us!</div>
        </body>
      </html>
    `;

    try {
      testPrintBtn.textContent = 'Printing...';
      const res: any = await pc.printReceipt({
        html: receiptHtml,
        deviceName: printerSelect?.value || undefined,
        silent: silentCheck?.checked,
      });

      if (res?.success) {
        alert('Test receipt sent to printer successfully!');
      } else {
        alert(`Print result: ${res?.error || 'Completed'}`);
      }
    } catch (e: any) {
      alert(`Print error: ${e.message}`);
    } finally {
      testPrintBtn.textContent = 'Test Print';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRenderer);
} else {
  initRenderer();
}

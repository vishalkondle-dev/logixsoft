/**
 * Logixsoft Payment Gateway - Universal In-Page Checkout SDK
 * Version: 1.0.0
 * Website: https://payment.logixsoft.in
 * 
 * Usage:
 * <script src="https://payment.logixsoft.in/checkout.js"></script>
 * <script>
 *   const checkout = new LogixsoftCheckout({
 *     orderId: 'ORD_123456789',
 *     onSuccess: function(response) {
 *       console.log('Payment Successful:', response);
 *     },
 *     onFailure: function(response) {
 *       console.error('Payment Failed:', response);
 *     },
 *     onClose: function() {
 *       console.log('Modal closed');
 *     }
 *   });
 *   checkout.open();
 * </script>
 */

(function (window, document) {
  'use strict';

  // Determine gateway host from script source or default
  var currentScript = document.currentScript;
  var DEFAULT_HOST = 'https://payment.logixsoft.in';

  if (currentScript && currentScript.src) {
    try {
      var scriptUrl = new URL(currentScript.src);
      DEFAULT_HOST = scriptUrl.origin;
    } catch (e) {}
  }

  function LogixsoftCheckout(options) {
    if (!(this instanceof LogixsoftCheckout)) {
      return new LogixsoftCheckout(options);
    }

    if (!options || (!options.orderId && !options.mandateId)) {
      throw new Error('[LogixsoftCheckout] orderId or mandateId is required.');
    }

    this.options = Object.assign(
      {
        host: DEFAULT_HOST,
        orderId: '',
        mandateId: '',
        theme: {
          color: '#4f46e5',
        },
        onSuccess: function () {},
        onFailure: function () {},
        onClose: function () {},
      },
      options
    );

    this.isOpen = false;
    this.overlay = null;
    this.iframe = null;
    this._messageListener = null;
    this._keyListener = null;
  }

  LogixsoftCheckout.prototype.open = function () {
    if (this.isOpen) return;

    var self = this;
    this.isOpen = true;

    // Inject required styles
    this._injectStyles();

    // Create backdrop overlay
    var overlay = document.createElement('div');
    overlay.className = 'logixsoft-checkout-backdrop';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    // Create modal wrapper
    var container = document.createElement('div');
    container.className = 'logixsoft-checkout-modal';

    // Create loading placeholder
    var loader = document.createElement('div');
    loader.className = 'logixsoft-checkout-loader';
    loader.innerHTML =
      '<div class="logixsoft-checkout-spinner"></div><p>Connecting securely to Logixsoft Gateway...</p>';
    container.appendChild(loader);

    // Create checkout iframe
    var iframe = document.createElement('iframe');
    iframe.className = 'logixsoft-checkout-iframe';
    iframe.setAttribute('allow', 'payment; clipboard-write; camera');
    iframe.setAttribute('title', 'Logixsoft UPI Payment Checkout');

    var embedUrl;
    if (this.options.mandateId) {
      embedUrl =
        this.options.host.replace(/\/+$/, '') +
        '/mandate/' +
        encodeURIComponent(this.options.mandateId) +
        '?embed=true';
    } else {
      embedUrl =
        this.options.host.replace(/\/+$/, '') +
        '/pay/' +
        encodeURIComponent(this.options.orderId) +
        '?embed=true';
    }
    iframe.src = embedUrl;

    iframe.onload = function () {
      if (loader && loader.parentNode) {
        loader.parentNode.removeChild(loader);
      }
    };

    container.appendChild(iframe);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    // Prevent body background scroll
    document.body.style.overflow = 'hidden';

    this.overlay = overlay;
    this.iframe = iframe;

    // Listen for cross-origin messages from the iframe
    this._messageListener = function (event) {
      // Validate origin if possible or trust message format
      if (!event.data || typeof event.data !== 'object') return;

      var type = event.data.type;
      var data = event.data.data || event.data;

      if (type === 'LOGIXSOFT_PAYMENT_SUCCESS' || type === 'LOGIXSOFT_MANDATE_SUCCESS') {
        if (typeof self.options.onSuccess === 'function') {
          self.options.onSuccess(data);
        }
        setTimeout(function () {
          self.close();
        }, 1200);
      } else if (type === 'LOGIXSOFT_PAYMENT_FAILED') {
        if (typeof self.options.onFailure === 'function') {
          self.options.onFailure(data);
        }
      } else if (type === 'LOGIXSOFT_MODAL_CLOSE' || type === 'LOGIXSOFT_CHECKOUT_CLOSE') {
        self.close();
      }
    };

    window.addEventListener('message', this._messageListener);

    // Close on Escape key
    this._keyListener = function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        self.close();
      }
    };
    window.addEventListener('keydown', this._keyListener);

    // Close when clicking outside modal container
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        self.close();
      }
    });

    // Trigger open animation
    setTimeout(function () {
      overlay.classList.add('logixsoft-active');
    }, 10);
  };

  LogixsoftCheckout.prototype.close = function () {
    if (!this.isOpen) return;
    var self = this;

    if (this.overlay) {
      this.overlay.classList.remove('logixsoft-active');
      setTimeout(function () {
        if (self.overlay && self.overlay.parentNode) {
          self.overlay.parentNode.removeChild(self.overlay);
        }
        document.body.style.overflow = '';
        self.overlay = null;
        self.iframe = null;
        self.isOpen = false;
      }, 250);
    }

    if (this._messageListener) {
      window.removeEventListener('message', this._messageListener);
      this._messageListener = null;
    }

    if (this._keyListener) {
      window.removeEventListener('keydown', this._keyListener);
      this._keyListener = null;
    }

    if (typeof this.options.onClose === 'function') {
      this.options.onClose();
    }
  };

  LogixsoftCheckout.prototype._injectStyles = function () {
    if (document.getElementById('logixsoft-checkout-styles')) return;

    var style = document.createElement('style');
    style.id = 'logixsoft-checkout-styles';
    style.textContent =
      '.logixsoft-checkout-backdrop {' +
      '  position: fixed;' +
      '  inset: 0;' +
      '  z-index: 999999;' +
      '  background: rgba(15, 23, 42, 0.6);' +
      '  backdrop-filter: blur(8px);' +
      '  -webkit-backdrop-filter: blur(8px);' +
      '  display: flex;' +
      '  align-items: center;' +
      '  justify-content: center;' +
      '  padding: 16px;' +
      '  opacity: 0;' +
      '  transition: opacity 0.25s ease;' +
      '  box-sizing: border-box;' +
      '}' +
      '.logixsoft-checkout-backdrop.logixsoft-active {' +
      '  opacity: 1;' +
      '}' +
      '.logixsoft-checkout-modal {' +
      '  position: relative;' +
      '  width: 100%;' +
      '  max-width: 410px;' +
      '  height: 580px;' +
      '  max-height: 94vh;' +
      '  background: #ffffff;' +
      '  border-radius: 22px;' +
      '  box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.06);' +
      '  overflow: hidden;' +
      '  display: flex;' +
      '  flex-direction: column;' +
      '  transform: scale(0.95) translateY(12px);' +
      '  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);' +
      '}' +
      '.logixsoft-checkout-backdrop.logixsoft-active .logixsoft-checkout-modal {' +
      '  transform: scale(1) translateY(0);' +
      '}' +
      '.logixsoft-checkout-iframe {' +
      '  width: 100%;' +
      '  height: 100%;' +
      '  border: none;' +
      '  display: block;' +
      '  background: transparent;' +
      '}' +
      '.logixsoft-checkout-loader {' +
      '  position: absolute;' +
      '  inset: 0;' +
      '  display: flex;' +
      '  flex-direction: column;' +
      '  align-items: center;' +
      '  justify-content: center;' +
      '  gap: 12px;' +
      '  background: #ffffff;' +
      '  color: #64748b;' +
      '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;' +
      '  font-size: 13px;' +
      '}' +
      '.logixsoft-checkout-spinner {' +
      '  width: 30px;' +
      '  height: 30px;' +
      '  border: 2.5px solid #f1f5f9;' +
      '  border-top-color: #4f46e5;' +
      '  border-radius: 50%;' +
      '  animation: logixsoft-spin 0.7s linear infinite;' +
      '}' +
      '@keyframes logixsoft-spin {' +
      '  to { transform: rotate(360deg); }' +
      '}' +
      '@media (max-width: 480px) {' +
      '  .logixsoft-checkout-backdrop { padding: 0; }' +
      '  .logixsoft-checkout-modal {' +
      '    max-width: 100%;' +
      '    height: 100%;' +
      '    max-height: 100%;' +
      '    border-radius: 0;' +
      '  }' +
      '}';
    document.head.appendChild(style);
  };

  // Export to global scope
  window.LogixsoftCheckout = LogixsoftCheckout;
})(typeof window !== 'undefined' ? window : this, typeof document !== 'undefined' ? document : {});

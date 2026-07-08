(function() {
  // Inject loader CSS styles
  const style = document.createElement('style');
  style.innerHTML = `
    .checkout-loader-backdrop {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      z-index: 200000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      color: #FFFFFF;
      font-family: 'Outfit', 'Inter', sans-serif;
    }
    .checkout-loader-backdrop.active {
      opacity: 1;
      pointer-events: auto;
    }
    .checkout-spinner {
      width: 50px;
      height: 50px;
      border: 5px solid rgba(255,255,255,0.1);
      border-top-color: #FF7020;
      border-radius: 50%;
      animation: checkout-spin 1s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes checkout-spin {
      to { transform: rotate(360deg); }
    }
    .checkout-loader-text {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
  `;
  document.head.appendChild(style);

  // Inject loader backdrop to body
  function injectCheckoutLoader() {
    if (document.getElementById('checkoutLoader')) return;
    const loader = document.createElement('div');
    loader.id = 'checkoutLoader';
    loader.className = 'checkout-loader-backdrop';
    loader.innerHTML = `
      <div class="checkout-spinner"></div>
      <div class="checkout-loader-text" id="checkoutLoaderText">Securing payment connection...</div>
    `;
    document.body.appendChild(loader);
  }

  function showCheckoutLoader(text) {
    injectCheckoutLoader();
    const loader = document.getElementById('checkoutLoader');
    const textEl = document.getElementById('checkoutLoaderText');
    if (textEl && text) textEl.textContent = text;
    if (loader) loader.classList.add('active');
  }

  function hideCheckoutLoader() {
    const loader = document.getElementById('checkoutLoader');
    if (loader) loader.classList.remove('active');
  }

  function processCashfreeCheckout(name, email, phone, amount, nextStepPath) {
    showCheckoutLoader("Securing connection with Cashfree...");
    
    // Dynamic return URL pointing to next page
    const returnUrl = window.location.origin + '/' + nextStepPath + '?order_id={order_id}';

    fetch('/api/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email, phone, amount, returnUrl })
    })
    .then(res => {
      if (!res.ok) {
        return res.json().then(err => { throw new Error(err.error || 'Gateway error') });
      }
      return res.json();
    })
    .then(data => {
      hideCheckoutLoader();
      
      if (typeof Cashfree !== 'function') {
        alert("Payment gateway loading failed. Please refresh the page and try again.");
        return;
      }
      
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isSandboxQuery = window.location.search.includes('sandbox=true') || window.location.search.includes('test=true');
      const cashfreeMode = (isLocal || isSandboxQuery) ? 'sandbox' : 'production';
      
      const cashfree = Cashfree({ mode: cashfreeMode });
      cashfree.checkout({
        paymentSessionId: data.payment_session_id,
        redirectTarget: '_self'
      });
    })
    .catch(err => {
      hideCheckoutLoader();
      console.error(err);
      alert("Payment creation failed: " + err.message);
    });
  }

  // Expose to window
  window.processCashfreeCheckout = processCashfreeCheckout;
  window.showCheckoutLoader = showCheckoutLoader;
  window.hideCheckoutLoader = hideCheckoutLoader;
})();

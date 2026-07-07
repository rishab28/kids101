/**
 * Secret Swap Funnel - Lead Capture, Exit Intent & Prefill Checkout System
 * Author: Priya & KhaduFarm Tech Team
 * Description: 
 * - Diabetic funnel: Strict exit-intent popups only (Zero checkout friction).
 * - Kids funnel: Opt-in modal on checkout CTA clicks + Exit-intent gifts popup.
 * - Auto-prefill: When opt-in form is filled, user details are automatically
 *   sent to Superprofile via query params, avoiding double data-entry!
 */

(function() {
  // CONFIGURATION: Google Sheets webhook URL
  const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxLAG9bSL8rdr-0YYwXxM61al5QP6FXURZqiuqmbHlcSHRI1dTcolrGPVfrBXxvyW5dtA/exec";
  
  // CONFIGURATION: Crisp Live Chat Website ID (DISABLED)
  const CRISP_WEBSITE_ID = "";
  
  let leadModalInjected = false;
  let targetPaymentUrl = ""; // Stores checkout destination URL if clicked from a CTA

  // Injected CSS Styles
  const style = document.createElement('style');
  style.innerHTML = `
    .lead-backdrop {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(8px);
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
      padding: 15px;
    }
    .lead-backdrop.active {
      opacity: 1;
      pointer-events: auto;
    }
    .lead-modal {
      background: #FFFFFF;
      width: 100%;
      max-width: 480px;
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.25);
      overflow: hidden;
      transform: scale(0.9);
      transition: transform 0.3s ease;
      position: relative;
      border: 1px solid rgba(255, 112, 32, 0.1);
    }
    .lead-backdrop.active .lead-modal {
      transform: scale(1);
    }
    .lead-header {
      background: linear-gradient(135deg, #10B981, #059669);
      color: #FFFFFF;
      padding: 22px 20px;
      text-align: center;
      position: relative;
    }
    .lead-header.checkout-theme {
      background: linear-gradient(135deg, #FF7020, #FF5500);
    }
    .lead-header h3 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 800;
      font-family: 'Outfit', 'Inter', sans-serif;
      line-height: 1.3;
    }
    .lead-header p {
      margin: 6px 0 0;
      font-size: 0.88rem;
      opacity: 0.9;
    }
    .lead-close {
      position: absolute;
      top: 12px;
      right: 12px;
      background: rgba(0,0,0,0.15);
      border: none;
      color: white;
      font-size: 1.2rem;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      transition: background 0.2s;
    }
    .lead-close:hover {
      background: rgba(0,0,0,0.3);
    }
    .lead-body {
      padding: 22px;
    }
    .lead-form-group {
      margin-bottom: 14px;
      text-align: left;
    }
    .lead-form-group label {
      display: block;
      font-size: 0.82rem;
      font-weight: 600;
      color: #475569;
      margin-bottom: 4px;
    }
    .lead-input {
      width: 100%;
      padding: 10px 13px;
      border: 1.5px solid #CBD5E1;
      border-radius: 10px;
      font-size: 0.9rem;
      transition: border-color 0.2s;
      outline: none;
      color: #1E293B;
    }
    .lead-input:focus {
      border-color: #10B981;
    }
    .lead-header.checkout-theme ~ .lead-body .lead-input:focus {
      border-color: #FF7020;
    }
    .lead-submit-btn {
      width: 100%;
      background: #10B981;
      color: white;
      border: none;
      padding: 12px;
      font-size: 1rem;
      font-weight: 700;
      border-radius: 10px;
      cursor: pointer;
      box-shadow: 0 5px 15px rgba(16, 185, 129, 0.25);
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 8px;
    }
    .lead-submit-btn:hover {
      background: #059669;
      transform: translateY(-1px);
    }
    .lead-header.checkout-theme ~ .lead-body .lead-submit-btn {
      background: #FF7020;
      box-shadow: 0 5px 15px rgba(255, 112, 32, 0.25);
    }
    .lead-header.checkout-theme ~ .lead-body .lead-submit-btn:hover {
      background: #E05300;
    }
    .lead-trust {
      text-align: center;
      font-size: 0.7rem;
      color: #64748B;
      margin-top: 12px;
    }
  `;
  document.head.appendChild(style);

  // Injects Modal Structure to DOM
  function injectModal() {
    if (leadModalInjected) return;
    
    const isKidsPage = window.location.href.includes("kids");
    
    // Default exit-intent setup values (Diabetic as default, modified dynamically in openLeadModal)
    let giftTitle = "🎁 WAIT! Get 7 Herbal Drinks & Kadha Recipes + 1 Grocery List + 50% OFF!";
    let giftSubtitle = "Fill this form to get 50% OFF (₹249 instead of ₹499) + your free gifts sent instantly!";
    let discountCode = isKidsPage ? "KIDS50" : "KHADU50";
    let paymentLink = isKidsPage ? "https://superprofile.bio/vp/FUIMWaYB?discountCode=KIDS50" : "https://superprofile.bio/vp/FUIMWaYB?discountCode=KHADU50";
    let gift1Name = isKidsPage ? "📥 Download 3 Free Recipes (PDF)" : "📥 Download 7 Herbal Drinks & Kadha Recipes (PDF)";
    let gift1Path = isKidsPage ? "deliverables/Five_Minute_Breakfast_Guide.pdf" : "final_deliverables_pdf_excel/Herbal_Drinks_Kadha_Recipes.pdf";
    let gift2Name = isKidsPage ? "📥 Download Empty Tiffin Calendar (Excel)" : "📥 Download Smart Grocery Lists (Excel)";
    let gift2Path = isKidsPage ? "deliverables/Empty_Tiffin_Calendar.xlsx" : "final_deliverables_pdf_excel/Smart_Grocery_Shopping_Lists.xlsx";
    
    const modalHtml = `
      <div class="lead-backdrop" id="leadBackdrop">
        <div class="lead-modal">
          <div class="lead-header" id="leadHeader">
            <button class="lead-close" id="leadCloseBtn">&times;</button>
            <h3 id="leadTitle">${giftTitle}</h3>
            <p id="leadSubtitle">${giftSubtitle}</p>
          </div>
          <div class="lead-body">
            <!-- LEAD CAPTURE FORM -->
            <form id="leadForm">
              <div class="lead-form-group">
                <label>Your Name / Aapka Naam</label>
                <input type="text" id="leadName" class="lead-input" placeholder="e.g. Neha Sharma" required />
              </div>
              <div class="lead-form-group">
                <label>WhatsApp Number (10 digits)</label>
                <input type="tel" id="leadPhone" class="lead-input" placeholder="e.g. 9876543210" pattern="[6-9][0-9]{9}" required />
              </div>
              <div class="lead-form-group">
                <label>Email Address</label>
                <input type="email" id="leadEmail" class="lead-input" placeholder="e.g. name@email.com" required />
              </div>
              
              <button type="submit" class="lead-submit-btn" id="leadSubmitBtn">
                Claim My Gifts & 50% Discount →
              </button>
              
              <div class="lead-trust">
                🔒 Protected by Indian DPDP Act 2023. We never share your details.
              </div>
            </form>
            
            <!-- SUCCESS STATE / DOWNLOAD SCREEN (EXIT INTENT ONLY) -->
            <div id="leadSuccess" style="display: none; text-align: center;">
              <div style="font-size: 2.2rem; margin-bottom: 5px;">🎉</div>
              <h4 style="color: #10B981; font-size: 1.15rem; font-weight: 800; margin: 0 0 5px;">Gifts Unlocked & 50% OFF Applied!</h4>
              
              <!-- Discount Box -->
              <div style="background: #FFF3E0; border: 1.5px dashed #FF7020; border-radius: 12px; padding: 12px; margin-bottom: 15px;">
                <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #E65100; font-weight: 700; display: block; margin-bottom: 3px;">Exclusive Coupon Unlocked</span>
                <strong style="font-size: 1.35rem; color: #D84315; letter-spacing: 1px; display: block; margin-bottom: 5px;" id="successDiscountCode">${discountCode}</strong>
                <p style="font-size: 0.82rem; color: #4E342E; margin: 0 0 10px; line-height: 1.4;">Claim the entire bundle at <b>50% OFF</b> (₹249 instead of ₹499) right now!</p>
                <a id="successPaymentLink" href="${paymentLink}" class="lead-submit-btn" style="background: #FF7020; box-shadow: 0 4px 12px rgba(255, 112, 32, 0.3); text-decoration: none; margin: 0 auto; width: 100%; max-width: 320px; font-size: 0.95rem;">Claim 50% Off & Buy Now →</a>
              </div>
              
              <!-- Downloads Box -->
              <div style="border-top: 1px solid #E2E8F0; padding-top: 12px; text-align: left;">
                <span style="font-size: 0.78rem; font-weight: 700; color: #475569; display: block; margin-bottom: 8px; text-align: center;">📥 Download Your Free Gifts:</span>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <a id="giftBtn1" href="${gift1Path}" class="lead-submit-btn" style="background: #10B981; text-decoration: none; margin: 0; font-size: 0.9rem; padding: 9px;" download>${gift1Name}</a>
                  <a id="giftBtn2" href="${gift2Path}" class="lead-submit-btn" style="background: #3B82F6; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2); text-decoration: none; margin: 0; font-size: 0.9rem; padding: 9px;" download>${gift2Name}</a>
                </div>
              </div>
              
              <button id="leadContinueBtn" class="lead-submit-btn" style="background: #64748B; box-shadow: none; font-size: 0.8rem; padding: 8px; margin-top: 15px; width: auto; display: inline-block;">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = modalHtml;
    document.body.appendChild(div);
    
    // Bind Events
    document.getElementById('leadCloseBtn').addEventListener('click', closeLeadModal);
    document.getElementById('leadContinueBtn').addEventListener('click', closeLeadModal);
    document.getElementById('leadBackdrop').addEventListener('click', function(e) {
      if (e.target === this) closeLeadModal();
    });
    document.getElementById('leadForm').addEventListener('submit', handleLeadSubmit);
    
    leadModalInjected = true;
  }

  function openLeadModal(isCheckoutModal = false, destinationUrl = "") {
    injectModal();
    
    const backdrop = document.getElementById('leadBackdrop');
    const header = document.getElementById('leadHeader');
    const title = document.getElementById('leadTitle');
    const subtitle = document.getElementById('leadSubtitle');
    const submitBtn = document.getElementById('leadSubmitBtn');
    
    const isKidsPage = window.location.href.includes("kids");
    targetPaymentUrl = isCheckoutModal ? destinationUrl : "";

    // Reset view
    document.getElementById('leadForm').style.display = 'block';
    document.getElementById('leadSuccess').style.display = 'none';

    if (isCheckoutModal) {
      // Checkout CTA Click Theme
      header.classList.add('checkout-theme');
      title.innerHTML = "⚡ Complete Your Order";
      subtitle.innerHTML = "Enter details to proceed to secure payment gateway";
      submitBtn.innerHTML = "Proceed to Secure Payment →";
    } else {
      // Exit Intent Bribe Theme
      header.classList.remove('checkout-theme');
      submitBtn.innerHTML = "Claim My Gifts & 50% Discount →";
      
      if (isKidsPage) {
        title.innerHTML = "🎁 WAIT! Get 3 Free Recipes + 1 Calendar + 50% OFF!";
        subtitle.innerHTML = "Fill this form to get 50% OFF (₹249 instead of ₹499) + your free gifts sent instantly!";
        document.getElementById('successDiscountCode').innerHTML = "KIDS50";
        document.getElementById('successPaymentLink').setAttribute('href', "https://superprofile.bio/vp/FUIMWaYB?discountCode=KIDS50");
        document.getElementById('giftBtn1').innerHTML = "📥 Download 3 Free Recipes (PDF)";
        document.getElementById('giftBtn1').setAttribute('href', "deliverables/Five_Minute_Breakfast_Guide.pdf");
        document.getElementById('giftBtn2').innerHTML = "📥 Download Empty Tiffin Calendar (Excel)";
        document.getElementById('giftBtn2').setAttribute('href', "deliverables/Empty_Tiffin_Calendar.xlsx");
      } else {
        title.innerHTML = "🎁 WAIT! Get 7 Herbal Drinks & Kadha Recipes + 1 Grocery List + 50% OFF!";
        subtitle.innerHTML = "Fill this form to get 50% OFF (₹249 instead of ₹499) + your free gifts sent instantly!";
        document.getElementById('successDiscountCode').innerHTML = "KHADU50";
        document.getElementById('successPaymentLink').setAttribute('href', "https://superprofile.bio/vp/FUIMWaYB?discountCode=KHADU50");
        document.getElementById('giftBtn1').innerHTML = "📥 Download 7 Herbal Drinks & Kadha Recipes (PDF)";
        document.getElementById('giftBtn1').setAttribute('href', "final_deliverables_pdf_excel/Herbal_Drinks_Kadha_Recipes.pdf");
        document.getElementById('giftBtn2').innerHTML = "📥 Download Smart Grocery Lists (Excel)";
        document.getElementById('giftBtn2').setAttribute('href', "final_deliverables_pdf_excel/Smart_Grocery_Shopping_Lists.xlsx");
      }
    }
    
    backdrop.classList.add('active');
    
    // Facebook Lead Event Tracking
    if (typeof fbq === 'function') {
      fbq('track', 'InitiateCheckout');
    }
  }

  function closeLeadModal() {
    const backdrop = document.getElementById('leadBackdrop');
    if (backdrop) {
      backdrop.classList.remove('active');
    }
  }

  function handleLeadSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('leadName').value.trim ? document.getElementById('leadName').value.trim() : document.getElementById('leadName').value;
    const phone = document.getElementById('leadPhone').value;
    const email = document.getElementById('leadEmail').value;
    
    const payload = {
      name: name,
      phone: phone,
      email: email,
      url: window.location.href,
      timestamp: new Date().toISOString()
    };

    // Save lead locally as fallback & for auto-prefill logic
    localStorage.setItem('funnel_lead', JSON.stringify(payload));
    
    // Post to Google Sheet / Webhook asynchronously using form-urlencoded for maximum compatibility
    if (WEBHOOK_URL && !WEBHOOK_URL.includes("placeholder")) {
      const formData = new URLSearchParams();
      formData.append('name', name);
      formData.append('phone', phone);
      formData.append('email', email);
      formData.append('url', window.location.href);

      fetch(WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        body: formData
      }).catch(err => console.log("Webhook fail:", err));
    }
    
    // Facebook Lead Capture Event
    if (typeof fbq === 'function') {
      fbq('track', 'Lead', {
        content_name: targetPaymentUrl ? 'Checkout Opt-in Form' : 'Exit Intent Gift Form',
        value: 0.00,
        currency: 'INR'
      });
    }

    if (targetPaymentUrl) {
      // IF CLICKED FROM CHECKOUT CTA: Auto-prefill and redirect directly to payment gateway!
      closeLeadModal();
      const connector = targetPaymentUrl.includes('?') ? '&' : '?';
      const prefilledUrl = targetPaymentUrl + connector + 
        `name=${encodeURIComponent(name)}` +
        `&email=${encodeURIComponent(email)}` +
        `&phone=${encodeURIComponent(phone)}` +
        `&mobile=${encodeURIComponent(phone)}`;
        
      setTimeout(function() {
        window.location.href = prefilledUrl;
      }, 150);
    } else {
      // IF CLICKED FROM EXIT INTENT: Show success download state + discount box!
      document.getElementById('leadForm').style.display = 'none';
      document.getElementById('leadSuccess').style.display = 'block';
    }
  }

  // --- EXIT INTENT TRIGGER LOGIC ---
  let exitIntentTriggered = false;
  
  function triggerExitIntent() {
    const isTestMode = window.location.search.includes('test=true');
    
    if (exitIntentTriggered && !isTestMode) return;
    
    // Check if user already submitted lead (ignored in test mode)
    if (localStorage.getItem('funnel_lead') && !isTestMode) return;
    
    exitIntentTriggered = true;
    openLeadModal(false); // Open exit-intent layout (with free gifts)
  }

  // 1. Desktop Exit Intent (Mouse leaves top of window)
  document.addEventListener('mouseleave', function(e) {
    if (e.clientY < 20) {
      triggerExitIntent();
    }
  });

  // 2. Mobile Exit Intent (Back button intercept hack)
  window.addEventListener('load', function() {
    setTimeout(function() {
      history.pushState({ exitIntent: true }, "", window.location.href);
    }, 1000);
  });
  
  window.addEventListener('popstate', function(e) {
    if (e.state && e.state.exitIntent) {
      triggerExitIntent();
      history.pushState(null, "", window.location.href);
    }
  });

  // 3. Mobile/Tablet Inactivity Timer (18 seconds)
  let idleTime = 0;
  const idleInterval = setInterval(function() {
    idleTime += 1;
    if (idleTime >= 18) {
      triggerExitIntent();
      clearInterval(idleInterval);
    }
  }, 1000);

  // Reset idle timer on user activity
  const resetTimer = () => { idleTime = 0; };
  document.addEventListener('mousemove', resetTimer);
  document.addEventListener('keypress', resetTimer);
  document.addEventListener('touchstart', resetTimer);
  document.addEventListener('scroll', resetTimer);

  // --- INTERCEPT CHECKOUT CTA BUTTONS ON KIDS PAGES ONLY ---
  function hookCheckoutButtons() {
    const isKidsPage = window.location.href.includes("kids");
    if (!isKidsPage) return; // ONLY run checkout intercept logic on kids pages!

    const buttons = document.querySelectorAll('a');
    buttons.forEach(function(btn) {
      const href = btn.getAttribute('href') || "";
      // Intercept if it links to superprofile
      if (href.includes("superprofile.bio") && !btn.id.includes("downsellCTA")) {
        btn.addEventListener('click', function(e) {
          // If they already filled out the lead form earlier, go straight to payment (pre-filled, bypassed in test mode)
          const isTestMode = window.location.search.includes('test=true');
          const savedLead = localStorage.getItem('funnel_lead');
          if (savedLead && !isTestMode) {
            try {
              const data = JSON.parse(savedLead);
              const connector = href.includes('?') ? '&' : '?';
              const prefilledUrl = href + connector + 
                `name=${encodeURIComponent(data.name)}` +
                `&email=${encodeURIComponent(data.email)}` +
                `&phone=${encodeURIComponent(data.phone)}` +
                `&mobile=${encodeURIComponent(data.phone)}`;
              window.location.href = prefilledUrl;
              return;
            } catch(err) {}
          }
          
          e.preventDefault();
          openLeadModal(true, href); // Open checkout capture form layout
        });
      }
    });
  }

  // Hook buttons
  window.addEventListener('DOMContentLoaded', hookCheckoutButtons);
  setTimeout(hookCheckoutButtons, 1000);
  setTimeout(hookCheckoutButtons, 3000);

  // --- CRISP LIVE CHAT WIDGET REMOVED ---

})();

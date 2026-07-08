export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, phone, amount, returnUrl } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const clientId = process.env.CASHFREE_CLIENT_ID;
    const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
    const env = process.env.CASHFREE_ENV || 'sandbox';

    if (!clientId || !clientSecret) {
      console.error('Missing Cashfree credentials');
      return res.status(500).json({ 
        error: 'Payment gateway configuration is missing. Please set environment variables.' 
      });
    }

    // Clean phone number (remove country code if +91, only keep digits, default to standard if invalid)
    let cleanPhone = (phone || '').replace(/\D/g, '');
    if (cleanPhone.startsWith('91') && cleanPhone.length > 10) {
      cleanPhone = cleanPhone.substring(2);
    }
    if (cleanPhone.length !== 10) {
      // Cashfree requires a valid 10-digit phone number. 
      // If invalid, fallback to a mock number (standard in sandbox, but should ideally be captured by UI validation)
      cleanPhone = '9999999999'; 
    }

    // Generate unique order ID
    const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderId = `order_${Date.now()}_${uniqueSuffix}`;
    const customerId = `cust_${Date.now()}_${uniqueSuffix}`;

    const host = env === 'production' ? 'api.cashfree.com' : 'sandbox.cashfree.com';
    const url = `https://${host}/pg/orders`;

    const requestBody = {
      order_amount: parseFloat(amount),
      order_currency: 'INR',
      order_id: orderId,
      customer_details: {
        customer_id: customerId,
        customer_name: name || 'Guest Customer',
        customer_email: email || 'customer@example.com',
        customer_phone: cleanPhone
      },
      order_meta: {
        return_url: (returnUrl || `https://${req.headers.host || 'localhost'}/upsell.html?order_id={order_id}`).replace('http://', 'https://')
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Cashfree API Error:', responseData);
      return res.status(response.status).json({ 
        error: responseData.message || 'Failed to create order with Cashfree' 
      });
    }

    return res.status(200).json({
      payment_session_id: responseData.payment_session_id,
      order_id: responseData.order_id,
      cf_order_id: responseData.cf_order_id
    });

  } catch (error) {
    console.error('Internal Server Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

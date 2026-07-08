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

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({ error: 'order_id is required' });
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

    const host = env === 'production' ? 'api.cashfree.com' : 'sandbox.cashfree.com';
    const url = `https://${host}/pg/orders/${encodeURIComponent(order_id)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-client-id': clientId,
        'x-client-secret': clientSecret,
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json'
      }
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('Cashfree Verify API Error:', responseData);
      return res.status(response.status).json({ 
        error: responseData.message || 'Failed to verify order with Cashfree' 
      });
    }

    const isPaid = responseData.order_status === 'PAID';

    return res.status(200).json({
      status: isPaid ? 'SUCCESS' : 'FAILED',
      order_status: responseData.order_status,
      order_amount: responseData.order_amount,
      order_currency: responseData.order_currency,
      customer_details: responseData.customer_details,
      payment_session_id: responseData.payment_session_id
    });

  } catch (error) {
    console.error('Internal Server Error in verify-payment:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

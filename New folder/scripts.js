// Set your Stripe publishable key from the backend env securely (inject to .env and HTML in prod)
const stripe = Stripe('pk_test_your_publishable_key'); // Or fetch dynamically for better security

const form = document.getElementById('payment-form');
const amountInput = document.getElementById('amount');
const methodSelect = document.getElementById('method');
const payBtn = document.getElementById('pay-btn');
const loader = document.getElementById('loading');
const errorDiv = document.getElementById('error');

let inFlight = false;

form.onsubmit = async (e) => {
  e.preventDefault();

  if (inFlight) return false; // Prevent duplicate submitting (double clicks)
  inFlight = true;
  payBtn.disabled = true;
  errorDiv.textContent = '';
  loader.style.display = 'block';

  // Fetch and basic validate
  const amountRs = Number(amountInput.value);
  const paymentMethod = methodSelect.value;

  // Validate amount locally as well (100 = ₹1 in paise)
  if (!amountRs || amountRs < 1 || amountRs > 10000) {
    errorDiv.textContent = 'Please enter an amount between ₹1 and ₹10,000.';
    loader.style.display = 'none';
    payBtn.disabled = false;
    inFlight = false;
    return;
  }

  // Create checkout session on the server (convert ₹ to paise)
  try {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Math.round(amountRs * 100), // paise!
        paymentMethod
      })
    });

    const session = await res.json();
    if (!res.ok) {
      errorDiv.textContent = session.error || "Server error";
      loader.style.display = 'none';
      payBtn.disabled = false;
      inFlight = false;
      return;
    }

    // Redirect to Stripe Checkout
    window.location.href = session.url;

  } catch (err) {
    errorDiv.textContent = 'Network or server issue. Please try again later.';
    loader.style.display = 'none';
    payBtn.disabled = false;
    inFlight = false;
    return;
  }
};

// Reset form state on changes
amountInput.oninput = methodSelect.onchange = () => {
  errorDiv.textContent = '';
  payBtn.disabled = false;
  inFlight = false;
};
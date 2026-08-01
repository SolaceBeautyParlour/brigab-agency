import "dotenv/config";

const PAYSTACK_BASE = "https://api.paystack.co";
const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

async function paystackFetch(path, options = {}) {
  let res;
  try {
    res = await fetch(`${PAYSTACK_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${SECRET_KEY}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (err) {
    // Network-level failure (Paystack unreachable, DNS issue, timeout) —
    // never let this bubble up as a raw fetch error to a paying student.
    console.error("Paystack network error:", err.message);
    throw new Error("Couldn't reach the payment service right now. Please try again in a moment.");
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    // Paystack (or something in between, like a proxy) returned something
    // that isn't JSON — treat this the same way, not as a parse error.
    console.error("Paystack returned a non-JSON response, status:", res.status);
    throw new Error("The payment service returned an unexpected response. Please try again.");
  }

  if (!data.status) {
    throw new Error(data.message || "Paystack request failed");
  }
  return data.data;
}

/**
 * Initializes a split transaction: the deposit goes to the hostel manager's
 * subaccount, the service fee stays with the main Brigab account.
 * Requires the hostel to already have a paystack_subaccount_code (set during
 * manager onboarding via createSubaccount below).
 */
export async function initializeSplitTransaction({
  email,
  amountGHS,          // total = deposit + service fee, in GHS (not pesewas)
  depositGHS,
  subaccountCode,
  reference,
  metadata,
}) {
  const amountPesewas = Math.round(amountGHS * 100);
  const serviceFeeGHS = amountGHS - depositGHS;
  const serviceFeePesewas = Math.round(serviceFeeGHS * 100);

  return paystackFetch("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email,
      amount: amountPesewas,
      reference,
      currency: "GHS",
      metadata,
      subaccount: subaccountCode,
      // `transaction_charge` is the slice that stays with the PLATFORM (Brigab) —
      // i.e. the 50 GHS service fee. Everything else settles to the subaccount
      // (the hostel manager), so Brigab never touches deposit/rent money.
      transaction_charge: serviceFeePesewas,
      bearer: "subaccount",
    }),
  });
}

/** Always verify server-side before trusting any payment as successful. */
export async function verifyTransaction(reference) {
  return paystackFetch(`/transaction/verify/${reference}`, { method: "GET" });
}

/** Manager onboarding step: create a Paystack subaccount for their hostel. */
export async function createSubaccount({ businessName, bankCode, accountNumber, percentageCharge }) {
  return paystackFetch("/subaccount", {
    method: "POST",
    body: JSON.stringify({
      business_name: businessName,
      settlement_bank: bankCode,
      account_number: accountNumber,
      percentage_charge: percentageCharge, // Brigab's cut of the deposit, if any (can be 0)
    }),
  });
}

/**
 * Ghana's bank codes live under type=ghipss, not the Nigeria-style dashboard
 * page — this powers the bank dropdown so managers pick a name, never type
 * a code by hand.
 */
export async function listGhanaBanks() {
  return paystackFetch("/bank?country=ghana&type=ghipss&currency=GHS", { method: "GET" });
}

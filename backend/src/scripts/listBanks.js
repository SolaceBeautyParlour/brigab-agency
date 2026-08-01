// Prints Ghana's real bank names + codes, straight from Paystack's API.
// Ghana banks live under type=ghipss (not the Nigeria-style dashboard page).
// Run with: npm run list-banks
import "dotenv/config";

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

async function main() {
  if (!SECRET_KEY) {
    console.error("PAYSTACK_SECRET_KEY is missing from .env");
    process.exit(1);
  }

  const res = await fetch(
    "https://api.paystack.co/bank?country=ghana&type=ghipss&currency=GHS",
    { headers: { Authorization: `Bearer ${SECRET_KEY}` } }
  );
  const data = await res.json();

  if (!data.status) {
    console.error("Paystack error:", data.message);
    process.exit(1);
  }

  console.log(`\nFound ${data.data.length} Ghana banks:\n`);
  for (const bank of data.data) {
    console.log(`${bank.code.padEnd(8)} ${bank.name}`);
  }
  console.log("\nUse the code on the left as the \"Bank code\" field when connecting a hostel's Paystack account.");
}

main();

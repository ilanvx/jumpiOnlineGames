/*
  HYP (Yaad Sarig) card payments: NOT CONNECTED YET.

  When you have a HYP terminal, put these in .env and fill in the two functions below:
    HYP_MASOF=...      terminal number (מסוף)
    HYP_KEY=...        API key
    HYP_PASSP=...      API password (PassP)
    PUBLIC_URL=https://jumpigames.com   (where HYP sends the player back)

  How HYP's "Pay Protocol" works (check every parameter against HYP's own documentation first):
  1. paymentUrl(): ask HYP to sign the payment details (action=APISign, What=SIGN, with Masof, KEY,
     PassP, Amount, Order = our order id, Info = product name, Coin=1 for shekels, UTF8=True, Sign=True)
     and send the player to the payment page that comes back (action=pay&... with the signature).
  2. verify(): when the player comes back to /api/store/hyp/return, HYP adds the result to the address
     (Id, CCode, Amount, Order, Sign, ...). Ask HYP to check that signature (action=APISign, What=VERIFY).
     Only CCode=0 with a valid signature AND the right amount means the order is paid.
  Nothing is ever given to the player before verify() says yes, and a paid order is only given once.
*/
export const hyp = {
  // true only when every setting is filled in AND the code below is finished
  ready() {
    return false; // switch to: Boolean(process.env.HYP_MASOF && process.env.HYP_KEY && process.env.HYP_PASSP)
  },
  // returns the address of HYP's payment page for this order
  async paymentUrl(order, user, product) {
    throw new Error("HYP payments are not connected yet.");
  },
  // checks what HYP sent back; returns { ok, orderId, ref, amount }
  async verify(query) {
    return { ok: false };
  },
};

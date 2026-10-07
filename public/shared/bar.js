/*
  The Dance Club bar (used by the game and the server): juices, shakes, slushies and snacks.
  No alcohol, ever: Jumpi is a game for kids. Prices are in coins and are charged by the server
  (socket "bar:buy"); what you finish fills your needs a little (realtime/needs.js).
  Only add new things at the END of the list (the place in the list is the item number).
*/
export const BAR_MENU = [
  // drinks
  { name: "Orange Juice", price: 8, type: "drink", c: "#ff8a1c", needs: { stamina: 20, hunger: 5 } },
  { name: "Berry Smoothie", price: 12, type: "drink", c: "#c13cff", needs: { stamina: 25, hunger: 10, fun: 5 } },
  { name: "Lemon Fizz", price: 8, type: "drink", c: "#2fd36b", needs: { stamina: 22, fun: 5 } },
  { name: "Choc Shake", price: 15, type: "drink", c: "#7a4a2a", needs: { stamina: 25, hunger: 15, fun: 10 } },
  { name: "Watermelon Cooler", price: 10, type: "drink", c: "#ff4f6b", needs: { stamina: 25, fun: 5 } },
  { name: "Blue Slushie", price: 12, type: "drink", c: "#1f9bff", needs: { stamina: 20, fun: 12 } },
  { name: "Mango Slush", price: 12, type: "drink", c: "#ffb21f", needs: { stamina: 25, hunger: 5, fun: 8 } },
  { name: "Strawberry Shake", price: 15, type: "drink", c: "#ff8fc0", needs: { stamina: 25, hunger: 15, fun: 10 } },
  // snacks
  { name: "French Fries", price: 15, type: "snack", c: "#e8423b", needs: { hunger: 30, fun: 5 } },
  { name: "Edamame", price: 10, type: "snack", c: "#5fbf4f", needs: { hunger: 20, stamina: 8 } },
  { name: "Potato Chips", price: 10, type: "snack", c: "#ffc21a", needs: { hunger: 18, fun: 6 } },
  { name: "Popcorn", price: 10, type: "snack", c: "#ff5f5f", needs: { hunger: 18, fun: 8 } },
  { name: "Nachos & Cheese", price: 18, type: "snack", c: "#ff9a1c", needs: { hunger: 30, fun: 8 } },
  { name: "Chicken Nuggets", price: 20, type: "snack", c: "#d0903a", needs: { hunger: 35 } },
  { name: "Mini Pretzels", price: 8, type: "snack", c: "#a0602a", needs: { hunger: 15, stamina: 5 } },
  { name: "Fruit Skewer", price: 12, type: "snack", c: "#ff5fa8", needs: { hunger: 18, stamina: 10 } },
];

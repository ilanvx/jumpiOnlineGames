/*
  Jumpi pets: used by the game page and by the server (prices are checked on the server).
  Each kind comes in three colours, and a fourth one only members can adopt ("member"). A player can have up to MAX_PETS
  (members MAX_PETS_MEMBER); one of them can walk with you, the others stay in your home. A pet always stays, also
  after a membership ends.
*/
export const PET_KINDS = [
  { id: "puppy", name: "Puppy", price: 300, colors: [["Golden", "#e8a85a"], ["Snowy", "#f4f1ea"], ["Choco", "#7a4a2a"], ["Cosmic", "#7b6cff", "member"]] },
  { id: "kitten", name: "Kitten", price: 300, colors: [["Ginger", "#ff9a3a"], ["Silver", "#a9b3c4"], ["Midnight", "#3d3d4c"], ["Rose gold", "#f2a7b5", "member"]] },
  { id: "bunny", name: "Bunny", price: 250, colors: [["Cotton", "#fbf7f0"], ["Cocoa", "#b07a4a"], ["Bubblegum", "#ffb3d1"], ["Mint frost", "#8fe8cf", "member"]] },
  { id: "hamster", name: "Hamster", price: 200, colors: [["Honey", "#f2b46a"], ["Cream", "#f6e2c4"], ["Pebble", "#b8b2aa"], ["Gold", "#ffc93a", "member"]] },
  { id: "panda", name: "Panda", price: 800, colors: [["Classic", "#ffffff"], ["Red panda", "#d0602a"], ["Candy", "#ffc4de"], ["Galaxy", "#4a2a9e", "member"]] },
  { id: "dragon", name: "Baby Dragon", price: 2500, colors: [["Leaf", "#3fcf6a"], ["Galaxy", "#9b5cff"], ["Ember", "#ff5a3a"], ["Royal gold", "#ffb81f", "member"]] },
];
export const PET_BY_ID = Object.fromEntries(PET_KINDS.map((k) => [k.id, k]));
export const MAX_PETS = 5;
export const MAX_PETS_MEMBER = 7;   // members have room for more
// 2–12 letters (English or Hebrew), numbers and spaces; at most 3 digits (no phone numbers)
export function petNameProblem(raw) {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2) return "Give your pet a name (at least 2 letters).";
  if (name.length > 12) return "That name is too long (12 letters at most).";
  if (!/^[A-Za-zא-ת0-9 ]+$/.test(name)) return "Use only letters and numbers.";
  if ((name.match(/[0-9]/g) || []).length > 3) return "Too many numbers in that name.";
  return null;
}
export const memberColor = (kind, color) => kind?.colors?.[color]?.[2] === "member";
export const cleanPetName = (raw) => String(raw ?? "").replace(/\s+/g, " ").trim();

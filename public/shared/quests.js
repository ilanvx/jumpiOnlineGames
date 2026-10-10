/*
  The people of Jumpi (residents who live in the city) and their quests. Used by the game and the server
  (routes/quests.js keeps every player's progress and checks each step).

  THE HOPWELL FAMILY: everyone here is family, and they built Jumpi Town together.
  A resident shows "?" over the head when they have a quest for you, "!" when you finished one and
  can collect the prize from them, and nothing otherwise.

  A quest: giver (who offers it), turnIn (who pays out; the giver if left out), needs (quests done first),
  steps (done in order), reward { coins, xp, item? } (item = a shop item id; already owned → its price in coins).
  Step types:
    talk    { npc }                       go and talk to someone (the server checks you're next to them)
    visit   { at:[x,z], r, place }        walk to a place
    collect { what, spots:[[x,z],…] }     pick up things lying around (each spot once)
    quiz    { questions:[{ q, options, a }] } answer right (a = index of the right option)
    buy     { slot, label }               buy one more item of that kind (shirt, hat, furniture…)
    adopt   {}                            adopt one more pet
    member  {}                            be a Jumpi member
    play    { kind:"minigame"|"job"|"duel", n }  play n mini-game rounds / serve n job orders / finish n board games
    level   { n }                         reach level n
*/
export const NPC_REACH = 6;     // how close you must be to talk to someone (also checked by the server)
export const PICK_REACH = 3;    // how close to pick up a thing

export const RESIDENTS = [
  {
    id: "ziggy", name: "Grandpa Ziggy", role: "The founder of Jumpi", at: [5.6, 0.4], face: -1.2,
    look: { color: 6, eyes: 0, hair: 5, shirt: 4, pants: 2, glasses: 0, hat: 14, neck: -1 },
    bio: "Fifty years ago Ziggy sailed to an empty island on a little wooden boat with his best friend, a bouncy blue dog called Jumpi. He built the first house, then the fountain in the Plaza, and named the whole town after his dog. Now he sits by the fountain and welcomes everyone who arrives.",
    family: "Married to Grandma Rosa. Dad of Luna and Bolt.",
  },
  {
    id: "rosa", name: "Grandma Rosa", role: "The gardener", at: [6, 99], face: Math.PI,
    look: { color: 4, eyes: 2, hair: 27, shirt: 18, pants: 1, glasses: 0, hat: 25, neck: -1 },
    bio: "Rosa planted every tree in Central Park with her own hands. She knows the name of every flower and every bird, and she started the Pet Center because she could never say no to a lost puppy.",
    family: "Married to Grandpa Ziggy. Mom of Luna and Bolt. Grandma of Mia and Kai.",
  },
  {
    id: "luna", name: "Luna", role: "The chef", at: [78, 66], face: Math.PI,
    look: { color: 3, eyes: 1, hair: 7, shirt: 14, pants: 3, glasses: -1, hat: -1, neck: -1 },
    bio: "Luna grew up cooking with Grandma Rosa and opened the first restaurant on Food Street. She invents a new pizza every week, and she knows Jumpi better than anyone, because everybody comes to eat at her place.",
    family: "Daughter of Ziggy and Rosa. Married to Captain Max. Mom of Mia and Kai.",
  },
  {
    id: "max", name: "Captain Max", role: "The harbor captain", at: [-106, -30], face: 0,
    look: { color: 1, eyes: 3, hair: 17, shirt: 1, pants: 2, glasses: -1, hat: 1, neck: -1 },
    bio: "Max arrived on a big ship in a storm, and Luna gave him a hot soup. He never left! Now he runs the harbor, fixes boats, and tells the best sea stories in town (some of them are even true).",
    family: "Married to Luna. Dad of Mia and Kai.",
  },
  {
    id: "mia", name: "Mia", role: "The top student", at: [71, 87.5], face: Math.PI,
    look: { color: 5, eyes: 4, hair: 6, shirt: 11, pants: 1, glasses: 9, hat: -1, neck: -1 },
    bio: "Mia reads three books a week and is the champion of every quiz at Jumpi School. She wants to be a scientist and build a rocket to the moon (she has already drawn the plans).",
    family: "Daughter of Luna and Captain Max. Kai's little sister. Grandpa Ziggy's favorite quiz partner.",
  },
  {
    id: "kai", name: "Kai", role: "The adventurer", at: [148, 66], face: Math.PI,
    look: { color: 2, eyes: 0, hair: 4, shirt: 5, pants: 0, glasses: 3, hat: -1, neck: -1 },
    bio: "Kai has been to every corner of Jumpi, from the top of Whisper Hills to the end of the airport runway. He loves the Fun District and is always looking for the next adventure.",
    family: "Son of Luna and Captain Max. Mia's big brother. Uncle Bolt's helper.",
  },
  {
    id: "stella", name: "Aunt Stella", role: "The fashion designer", at: [-62, 49], face: Math.PI / 2,
    look: { color: 7, eyes: 2, hair: 24, shirt: 6, pants: 4, glasses: 4, hat: 28, neck: -1 },
    bio: "Stella designs the clothes in every shop on Shopping Street. She says the right hat can change your whole day. She moved to Jumpi to marry Bolt and filled the town with colour.",
    family: "Married to Uncle Bolt. Aunt of Mia and Kai.",
  },
  {
    id: "bolt", name: "Uncle Bolt", role: "The builder", at: [-62, 14], face: Math.PI / 2,
    look: { color: 0, eyes: 1, hair: 10, shirt: 23, pants: 2, glasses: -1, hat: 5, neck: -1 },
    bio: "Bolt built the train station, the warehouses and half of the houses in Jumpi. If something is broken, Bolt can fix it. If it isn't broken, Bolt can make it better, and maybe add a rocket.",
    family: "Son of Ziggy and Rosa. Luna's brother. Married to Aunt Stella.",
  },
];
export const RESIDENT_BY_ID = Object.fromEntries(RESIDENTS.map((r) => [r.id, r]));

const T = (npc) => ({ type: "talk", npc });
export const QUESTS = [
  // ---------- MEET JUMPI: the first chain, from one family member to the next ----------
  { id: "hello", giver: "ziggy", turnIn: "rosa", title: "Meet Jumpi",
    intro: "Welcome to Jumpi, the town I built with my own two hands! Everyone here is family. Go and say hi to my wife, Grandma Rosa. She's in Central Park with her flowers.",
    done: "Ziggy sent you? Oh, how lovely! Welcome, welcome!",
    steps: [T("rosa")], reward: { coins: 50, xp: 60 } },
  { id: "garden", giver: "rosa", needs: ["hello"], title: "Rosa's Flowers",
    intro: "The wind blew my flowers all over the park! Could you find 5 of them for me? Look for the pink flowers on the grass.",
    done: "All five! They're perfect. Thank you, sweetie.",
    steps: [{ type: "collect", what: "flower", spots: [[-8, 104], [12, 108], [-14, 122], [18, 124], [2, 136]] }],
    reward: { coins: 100, xp: 120 } },
  { id: "to-luna", giver: "rosa", turnIn: "luna", needs: ["garden"], title: "Lunch at Luna's",
    intro: "You must be hungry after all that! My daughter Luna is the best chef in town. Go and visit her on Food Street.",
    done: "Mom told me you were coming! Come in, come in!",
    steps: [T("luna")], reward: { coins: 50, xp: 60 } },
  { id: "luna-quiz", giver: "luna", needs: ["to-luna"], title: "Luna's Jumpi Quiz",
    intro: "Everybody eats at my place, so I hear everything about this town. Let's see how well you know Jumpi already!",
    done: "Wow, you really know your way around!",
    steps: [{ type: "quiz", questions: [
      { q: "Who built the first house in Jumpi?", options: ["Captain Max", "Grandpa Ziggy", "Mia"], a: 1 },
      { q: "Where do you adopt a pet?", options: ["The Pet Center", "The airport", "The harbor"], a: 0 },
      { q: "What's the name of the big park in the middle of town?", options: ["Sunny Park", "Central Park", "Maple Garden"], a: 1 },
    ] }], reward: { coins: 120, xp: 150 } },
  { id: "to-max", giver: "luna", turnIn: "max", needs: ["luna-quiz"], title: "The Captain",
    intro: "My husband, Captain Max, needs a helping hand at the harbor. Tell him I sent you!",
    done: "Ahoy! Any friend of Luna's is a friend of mine!",
    steps: [T("max")], reward: { coins: 50, xp: 60 } },
  { id: "shells", giver: "max", needs: ["to-max"], title: "Shells on the Quay",
    intro: "A big wave knocked over my bucket of lucky shells! There are 6 of them lying along the quay. Can you bring them back?",
    done: "My lucky shells! Now the sea will be kind to us again.",
    steps: [{ type: "collect", what: "shell", spots: [[-150, -33], [-138, -36], [-124, -33], [-96, -36], [-84, -33], [-74, -36]] }],
    reward: { coins: 150, xp: 180 } },
  { id: "to-mia", giver: "max", turnIn: "mia", needs: ["shells"], title: "The Clever One",
    intro: "My daughter Mia is the cleverest kid at Jumpi School. Go and meet her, she loves new friends!",
    done: "Hi! Dad says you found all his shells. Cool!",
    steps: [T("mia")], reward: { coins: 50, xp: 60 } },
  { id: "mia-games", giver: "mia", needs: ["to-mia"], title: "Game Time",
    intro: "Did you know Jumpi has mini-games all over town? The beach, the park, the water park... Play 2 of them and come back to tell me!",
    done: "You're a natural! Grandpa Ziggy will be so proud.",
    steps: [{ type: "play", kind: "minigame", n: 2 }], reward: { coins: 150, xp: 200 } },
  { id: "to-kai", giver: "mia", turnIn: "kai", needs: ["mia-games"], title: "My Big Brother",
    intro: "My brother Kai is somewhere in the Fun District. He knows every secret spot in Jumpi. Go find him!",
    done: "Mia sent you? Then you're ready for an adventure!",
    steps: [T("kai")], reward: { coins: 50, xp: 60 } },
  { id: "tour", giver: "kai", needs: ["to-kai"], title: "Kai's Grand Tour",
    intro: "Let's see if you can keep up! Run to the beach, then to the airport, then to the top of Whisper Hills. Go go go!",
    done: "You did the whole tour! You're a real Jumpi explorer now.",
    steps: [{ type: "visit", at: [70, -24], r: 8, place: "The Boardwalk" }, { type: "visit", at: [200, 40], r: 10, place: "The Airport" }, { type: "visit", at: [-40, 166], r: 10, place: "Whisper Hills" }],
    reward: { coins: 180, xp: 220 } },
  { id: "to-stella", giver: "kai", turnIn: "stella", needs: ["tour"], title: "Aunt Stella's Shop",
    intro: "You look like an explorer, but you need some style too! My Aunt Stella is on Shopping Street.",
    done: "Darling! Kai said you'd come. Let me look at you!",
    steps: [T("stella")], reward: { coins: 50, xp: 60 } },
  { id: "style", giver: "stella", needs: ["to-stella"], title: "Something New to Wear",
    intro: "Every Jumpi needs a new shirt now and then! Open the Shop and buy any shirt you like, then show me.",
    done: "Fabulous! That shirt was made for you.",
    steps: [{ type: "buy", slot: "shirt", label: "a shirt" }], reward: { coins: 200, xp: 250 } },
  { id: "to-bolt", giver: "stella", turnIn: "bolt", needs: ["style"], title: "The Builder",
    intro: "My husband Bolt is at Jumpi Station. He built half this town! Go say hello.",
    done: "Hey there! Stella says you've got great taste!",
    steps: [T("bolt")], reward: { coins: 50, xp: 60 } },
  { id: "cozy-home", giver: "bolt", needs: ["to-bolt"], title: "A Cozy Home",
    intro: "Every house needs furniture! Buy any piece of furniture in the Shop, then put it in your home.",
    done: "Now that's a home! I couldn't have built it better myself.",
    steps: [{ type: "buy", slot: "furniture", label: "a piece of furniture" }], reward: { coins: 200, xp: 250 } },
  { id: "family", giver: "bolt", turnIn: "ziggy", needs: ["cozy-home"], title: "Back to Grandpa",
    intro: "You've met the whole family! Go back to Grandpa Ziggy by the fountain in the Plaza. He's got something special for you.",
    done: "You met all of us! Now you're part of the Jumpi family too. This is for you.",
    steps: [T("ziggy")], reward: { coins: 500, xp: 600, item: "neck:8" } },

  // ---------- after the first chain: quests from everyone ----------
  { id: "pet-friend", giver: "rosa", needs: ["family"], title: "A Furry Friend",
    intro: "Every child in Jumpi deserves a pet. Visit the Pet Center at the end of the park and adopt one!",
    done: "Look at that sweet face! Take good care of each other.",
    steps: [{ type: "adopt" }], reward: { coins: 300, xp: 300 } },
  { id: "story-quiz", giver: "ziggy", needs: ["family"], title: "The Family Story",
    intro: "Do you remember everyone you met? Let's see how well you know the Hopwell family!",
    done: "You remember everything! You're one of us now.",
    steps: [{ type: "quiz", questions: [
      { q: "What was the name of Grandpa Ziggy's dog?", options: ["Bolt", "Jumpi", "Max"], a: 1 },
      { q: "Who is Luna married to?", options: ["Captain Max", "Uncle Bolt", "Kai"], a: 0 },
      { q: "Who designs the clothes on Shopping Street?", options: ["Grandma Rosa", "Mia", "Aunt Stella"], a: 2 },
      { q: "Who is Kai's little sister?", options: ["Mia", "Luna", "Stella"], a: 0 },
    ] }], reward: { coins: 300, xp: 350 } },
  { id: "gamer", giver: "mia", needs: ["family"], title: "Game Champion",
    intro: "Ready for a real challenge? Play 5 mini-games and become a game champion!",
    done: "Five games! You're officially a champion.",
    steps: [{ type: "play", kind: "minigame", n: 5 }], reward: { coins: 250, xp: 300 } },
  { id: "bottles", giver: "max", needs: ["family"], title: "Messages in Bottles",
    intro: "Bottles with secret messages keep washing up on the Boardwalk! Find all 6 of them before the tide takes them back.",
    done: "Six bottles! I'll read the messages tonight by the fire.",
    steps: [{ type: "collect", what: "bottle", spots: [[60, -24], [96, -24], [132, -24], [168, -24], [210, -24], [250, -24]] }],
    reward: { coins: 250, xp: 300 } },
  { id: "hard-worker", giver: "bolt", needs: ["family"], title: "A Hard Worker",
    intro: "In Jumpi, everybody helps! Get a job from your phone's Jobs app and finish 10 orders at work.",
    done: "Ten orders! You're the hardest worker in town.",
    steps: [{ type: "play", kind: "job", n: 10 }], reward: { coins: 300, xp: 350 } },
  { id: "rising-star", giver: "kai", needs: ["family"], title: "Rising Star",
    intro: "The best explorers keep growing. Reach level 10 and come show me your new badge!",
    done: "Level 10! That badge looks awesome on you.",
    steps: [{ type: "level", n: 10 }], reward: { coins: 400, xp: 300, item: "glasses:4" } },
  { id: "chef-quiz", giver: "luna", needs: ["family"], title: "Luna's Hard Quiz",
    intro: "You think you know Jumpi? This time the questions are harder!",
    done: "Incredible! Nobody ever gets all of these right.",
    steps: [{ type: "quiz", questions: [
      { q: "How many players can play Tic-Tac-Toe together?", options: ["One", "Two", "Four"], a: 1 },
      { q: "What happens if you leave your vehicle outside a parking lot?", options: ["Nothing", "It gets towed", "It turns into a boat"], a: 1 },
      { q: "Where can you play the piano in Jumpi?", options: ["At home or the Dance Club", "At the airport", "At the harbor"], a: 0 },
    ] }], reward: { coins: 250, xp: 300 } },
  { id: "club", giver: "stella", needs: ["family"], title: "The Members Club",
    intro: "Members get special clothes from my newest collection! When you become a Jumpi member, come and tell me.",
    done: "Welcome to the club! You look fantastic.",
    steps: [{ type: "member" }], reward: { coins: 500, xp: 400 } },
];
export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
export const turnInOf = (q) => q.turnIn || q.giver;

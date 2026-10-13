/*
  The autumn 2026 wardrobe: new hats, glasses and neckwear (items in public/shared/items/heads.js).
  HAT_STYLES[id](o, C, H)   C = {g, c1, c2, dark, M, dome, yAt, top, S, mb} from buildHat (head space)
  NECK_STYLES[id](o, C, H)  C = {g, c1, c2, M, loop, front, chain, along, faceFront} from buildNeck (body space)
  GLASSES_STYLES[id](o, g, C, H)  C = {eyeL, eyeR, Y, Z, rrect, ext, rod, starShape, heartShape} (head space)
  Hat / neck builders add to C.g and may return "raw" to skip merging (for parts that move on their own).
*/
export const HAT_STYLES = {};
export const NECK_STYLES = {};
export const GLASSES_STYLES = {};

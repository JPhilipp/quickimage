export function number(min, max) {
  return Math.random() * (max - min + 1) + min;
}

export function int(min, max) {
  return Math.floor(number(min, max));
}

export function arrayItem(array) {
  const randomIndex = int(0, array.length - 1);
  return array[randomIndex];
}

export function chance(value) {
  return Math.random() <= value;
}

export function fuzzy(value, max) {
  return number(value - max, value + max);
}

export function sign() {
  return chance(0.5) ? 1 : -1;
}

export function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = int(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

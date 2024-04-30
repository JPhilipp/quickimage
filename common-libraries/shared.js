export function delay(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export function getMinMax(number, min, max) {
  return Math.max(min, Math.min(max, number));
}

export function getDistance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function getFormattedTime() {
  return (new Date()).toLocaleTimeString('en-US', { hour12: false });
}

export function envToBoolean(value) {
  return value && value.toLowerCase() === 'true';
}

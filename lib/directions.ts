/**
 * "Directions" link for a spot.
 *
 * Opens the phone's Google Maps (app on Android, app or browser on iPhone,
 * browser on a laptop) with the spot as the destination, ready to navigate.
 * Free, no API key: it's just a normal Google Maps link.
 *
 * Later (database step) a spot can have a separate parking point; then we
 * navigate to the parking instead of the viewing spot itself.
 */
export function directionsUrl(lat: number, lon: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}
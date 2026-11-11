const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function distanceMeters(origin, destination) {
  const latitudeDifference = toRadians(destination.latitud - origin.latitud);
  const longitudeDifference = toRadians(destination.longitud - origin.longitud);
  const originLatitude = toRadians(origin.latitud);
  const destinationLatitude = toRadians(destination.latitud);
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude)
    * Math.sin(longitudeDifference / 2) ** 2;
  const boundedHaversine = Math.min(1, Math.max(0, haversine));
  const centralAngle = 2 * Math.atan2(Math.sqrt(boundedHaversine), Math.sqrt(1 - boundedHaversine));
  return EARTH_RADIUS_METERS * centralAngle;
}

module.exports = { distanceMeters };

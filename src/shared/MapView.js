import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Workaround marker icons when using leaflet with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png')
});

function nmToMeters(nm) {
  return nm * 1852;
}

function destinationPoint(lat, lon, bearingDeg, distanceMeters) {
  const R = 6371000; // earth radius meters
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const dR = distanceMeters / R;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(bearing)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(dR) * Math.cos(lat1),
    Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2)
  );

  return { lat: (lat2 * 180) / Math.PI, lon: (lon2 * 180) / Math.PI };
}

export default function MapView({ aircraft = [], vor = { lat: 21.15, lon: 80.1, name: 'GDA VOR', frequency: '114.2 MHz' } }) {
  const center = [vor.lat, vor.lon];

  // Function to get aircraft position (from lastReported or direct lat/lon, or calculate from radial/distance)
  const getPosition = (a) => {
    if (a.lastReported?.lat !== undefined && a.lastReported?.lon !== undefined) {
      return { lat: a.lastReported.lat, lon: a.lastReported.lon };
    }
    if (a.lat !== undefined && a.lon !== undefined) {
      return { lat: a.lat, lon: a.lon };
    }
    // Calculate from radial and distance if available
    if (a.radial !== undefined && a.distanceNm !== undefined) {
      const meters = nmToMeters(a.distanceNm);
      return destinationPoint(vor.lat, vor.lon, a.radial, meters);
    }
    return null;
  };
  
  // Filter aircraft with valid coordinates
  const aircraftWithCoords = aircraft.filter(a => getPosition(a));
  console.log('MapView: total aircraft:', aircraft.length, 'with valid coords:', aircraftWithCoords.length);
  if (aircraftWithCoords.length > 0) {
    console.log('MapView: sample aircraft:', aircraftWithCoords.slice(0, 3).map(a => {
      const pos = getPosition(a);
      return { id: a.id, callsign: a.callsign, lat: pos?.lat, lon: pos?.lon };
    }));
  }

  return (
    <MapContainer center={center} zoom={9} style={{ width: '100%', height: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={center}>
        <Popup>
          <div>
            <strong>GDA VOR</strong><br />
            Birsi Airport (VAGD)<br />
            Frequency: 114.2 MHz<br />
            Coordinates: {vor.lat.toFixed(3)}°N, {vor.lon.toFixed(3)}°E<br />
            Magnetic Variation: 0.1°W (2025)
          </div>
        </Popup>
      </Marker>
      <Circle center={center} radius={nmToMeters(25)} pathOptions={{ color: 'blue', opacity: 0.3 }} />
      {aircraftWithCoords.map(a => {
        const pos = getPosition(a);
        const isOutbound = a.lastReported?.outbound || false;
        const radial = a.radial || 0;
        const distanceNm = a.distanceNm || 0;

        // Create a line to show direction
        let linePositions = [];
        if (isOutbound) {
          // For outbound: line from VOR through aircraft position extending further
          const extendedPos = destinationPoint(vor.lat, vor.lon, radial, nmToMeters(distanceNm + 5));
          linePositions = [[vor.lat, vor.lon], [pos.lat, pos.lon], [extendedPos.lat, extendedPos.lon]];
        } else {
          // For inbound: line from aircraft position towards VOR
          const towardsVorPos = destinationPoint(pos.lat, pos.lon, radial + 180, nmToMeters(2)); // opposite direction
          linePositions = [[towardsVorPos.lat, towardsVorPos.lon], [pos.lat, pos.lon]];
        }

        return (
          <React.Fragment key={a.id}>
            <Marker position={[pos.lat, pos.lon]}>
              <Popup>
                <div>
                  <strong>{a.callsign}</strong>
                  <div>Phase: {a.phase}</div>
                  <div>Alt: {a.altitudeFeet || a.altitude_feet || 0} ft</div>
                  <div>Radial: {radial}°</div>
                  <div>Distance: {distanceNm} nm</div>
                  <div>Direction: {isOutbound ? 'Outbound' : 'Inbound'}</div>
                  <div>Runway: {a.runway}</div>
                </div>
              </Popup>
            </Marker>
            <Polyline positions={linePositions} pathOptions={{ color: isOutbound ? 'red' : 'green', weight: 2, opacity: 0.7 }} />
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
}

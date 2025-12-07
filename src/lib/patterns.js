// Pattern leg types and configurations for circuit training

// RWY 22 Right-Hand Circuit Pattern
export const PATTERN_22_RIGHT = {
  upwind: {
    radial_deg: 225,
    heading_deg: 225,
    default_distance_nm: 3,
    default_altitude_ft: 2000,
    inbound_outbound: 'outbound',
    phase: 'airborne',
    label: 'Upwind',
  },
  deadside: {
    radial_deg: 225,
    heading_deg: 45,
    default_distance_nm: 3,
    default_altitude_ft: 2000,
    inbound_outbound: 'outbound',
    phase: 'airborne',
    label: 'Deadside',
  },
  crosswind: {
    radial_deg: 225,
    heading_deg: 135,
    default_distance_nm: 3,
    default_altitude_ft: 2000,
    inbound_outbound: 'outbound',
    phase: 'airborne',
    label: 'Crosswind',
  },
  downwind: {
    radial_deg: 45,
    heading_deg: 45,
    default_distance_nm: 3,
    default_altitude_ft: 2000,
    inbound_outbound: 'outbound',
    phase: 'airborne',
    label: 'Downwind',
  },
  base: {
    radial_deg: 315,
    heading_deg: 315,
    default_distance_nm: 3,
    default_altitude_ft: 1800,
    inbound_outbound: 'outbound',
    phase: 'approach',
    label: 'Base',
  },
  final: {
    radial_deg: 225,
    heading_deg: 225,
    default_distance_nm: 2,
    default_altitude_ft: 1200,
    inbound_outbound: 'inbound',
    phase: 'approach',
    label: 'Final',
  },
};

// RWY 04 Right-Hand Circuit Pattern
export const PATTERN_04_RIGHT = {
  upwind: {
    radial_deg: 45,
    heading_deg: 45,
    default_distance_nm: 3,
    default_altitude_ft: 2000,
    inbound_outbound: 'outbound',
    phase: 'airborne',
    label: 'Upwind',
  },
  deadside: {
    radial_deg: 45,
    heading_deg: 315,
    default_distance_nm: 3,
    default_altitude_ft: 2000,
    inbound_outbound: 'outbound',
    phase: 'airborne',
    label: 'Deadside',
  },
  crosswind: {
    radial_deg: 45,
    heading_deg: 315,
    default_distance_nm: 3,
    default_altitude_ft: 2000,
    inbound_outbound: 'outbound',
    phase: 'airborne',
    label: 'Crosswind',
  },
  downwind: {
    radial_deg: 225,
    heading_deg: 225,
    default_distance_nm: 3,
    default_altitude_ft: 2000,
    inbound_outbound: 'outbound',
    phase: 'airborne',
    label: 'Downwind',
  },
  base: {
    radial_deg: 135,
    heading_deg: 135,
    default_distance_nm: 3,
    default_altitude_ft: 1800,
    inbound_outbound: 'outbound',
    phase: 'approach',
    label: 'Base',
  },
  final: {
    radial_deg: 45,
    heading_deg: 45,
    default_distance_nm: 2,
    default_altitude_ft: 1200,
    inbound_outbound: 'inbound',
    phase: 'approach',
    label: 'Final',
  },
};

/**
 * Get pattern specification for a given runway and leg
 */
export function getPatternFor(runway, leg) {
  const patterns = runway === '22' ? PATTERN_22_RIGHT : PATTERN_04_RIGHT;
  return patterns[leg];
}

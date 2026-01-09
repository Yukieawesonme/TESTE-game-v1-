
export const inputState = {
  joystick: { x: 0, y: 0 },
  cameraJoystick: { x: 0, y: 0 },
  jump: false,
  sprint: false,
  look: {
    theta: 0, // Horizontal rotation
    phi: 0.5,  // Vertical rotation
  },
  settings: {
    inverted: false
  },
  characterData: {
    x: 0,
    z: 0,
    rotation: 0,
    isAtBoundary: false
  },
  worldData: {
    // Array of {x, z, radius} for collision
    solids: [] as { x: number, z: number, r: number }[]
  }
};

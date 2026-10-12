export type StudioFocus = "studio" | "radar" | "vektr" | "lab"

export interface StudioActivity {
  name: string
  activity: string
  room: StudioFocus
}

export const PALETTE = {
  cyan: 0x38e8ff,
  magenta: 0xff3ea5,
  violet: 0x8b6bff,
  amber: 0xffb347,
  lime: 0x8dffb0,
  deep: 0x0a1017,
  floor: 0x1d2732,
  floorAlt: 0x18212b,
  wall: 0x2c3744,
  wallDeep: 0x1d2731,
  trim: 0x3d4a57,
  metal: 0x6b7887,
  metalDark: 0x3a4550,
  fabric: 0x33404f,
  wood: 0x5a4a42,
  neonPink: 0xff5fa8,
} as const

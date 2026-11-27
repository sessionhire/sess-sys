/**
 * Types for the vendored tipping-point solver (ledwall.js): the parts the LED
 * screen builder uses (ADR 0207). SI throughout: metres, kilograms, m/s.
 */

export interface LedWallInput {
  wallWidth: number
  wallHeight: number
  /** How far the bottom of the wall is off the ground. */
  wallBottom: number
  wallDepth: number
  /** What a square metre of wall weighs, cabinets and frame. */
  wallArealMass: number
  /** The wall stands on the ground or the plates, rather than hanging off the truss. */
  wallOnGround?: boolean
  trussHeight: number
  trussDepth: number
  trussWidth?: number
  trussLinearMass: number
  /** How far the base plate reaches in front of and behind the truss's centre, and how wide it is. */
  plateFront: number
  plateBack: number
  plateWidth: number
  plateMass: number
  /** Ballast on each plate. */
  ballastMass: number
  windSpeed?: number
  safetyFactor?: number
  forceCoefficient?: number
  maxSpacing?: number
  maxLoadPerUpright?: number
  /** Sets the count by hand, instead of the fewest the checks allow. */
  uprights?: number
}

export interface LedWallConstraint {
  id: 'spacing' | 'load' | 'stability'
  label: string
  /** The count it asks for, Infinity when no count can meet it. */
  n: number
  wanted: number
}

export interface LedWallResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  uprights: number
  minimumUprights: number
  /** Which of the three checks set the count. */
  governingConstraint: LedWallConstraint
  constraints: LedWallConstraint[]
  /** Centre to centre, in metres. */
  spacing: number
  passes: boolean
  buildable: boolean
  stabilityAchievable: boolean
  countAchievable: boolean
  /** The check no count of uprights can meet, where there is one. */
  blockedBy: LedWallConstraint | null
  worstRatio: number
  safetyFactor: number
  ballastPerUpright: number
  ballastNeededPerUpright: number
  ballastTotal: number
  wallMassPerUpright: number
  loadPerUpright: number
  totalMass: number
  /** The wind at which the safety factor runs out, and the wind at which it goes over. */
  limitingWindSpeed: number
  tippingWindSpeed: number
  windSpeed: number
  beaufort: number
  beaufortName: string
  maxSpacing: number
  maxLoadPerUpright: number
}

declare const LedWall: {
  solve(input: LedWallInput): LedWallResult
  /** The Beaufort number for a wind in m/s, and the scale's names and what each looks like on land. */
  beaufort(speed: number): number
  BEAUFORT_NAMES: readonly string[]
  BEAUFORT_SIGNS: readonly string[]
}

export default LedWall

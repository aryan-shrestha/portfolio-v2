/**
 * Elbow target for one arm. While the shoulder is still swinging (more than 0.35 rad from its
 * target) the elbow folds 1.6*sin|theta| so the hand never sweeps wide; once the arm has arrived
 * the gesture's own elbow angle applies (spec §7.5.3).
 */
export function elbowTarget(
  shoulderAngle: number,
  shoulderTarget: number,
  gestureElbow: number,
  side: -1 | 1,
): number {
  const swinging = Math.abs(shoulderAngle - shoulderTarget) > 0.35
  const fold = swinging ? 1.6 * Math.sin(Math.abs(shoulderAngle)) : 0
  return Math.abs(gestureElbow) >= fold ? gestureElbow : Math.sign(shoulderAngle || side) * fold
}

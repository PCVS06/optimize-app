export const PRIMARY_LAUNCH_ORDER = ["agent", "browser"] as const;
export const SUPPORTING_LAUNCH_ORDER = ["browser", "agent"] as const;
export type BuiltInLaunchItemId = (typeof PRIMARY_LAUNCH_ORDER)[number];
export function getBuiltInLaunchOrder(purpose: "primary" | "supporting") {
  return purpose === "supporting" ? SUPPORTING_LAUNCH_ORDER : PRIMARY_LAUNCH_ORDER;
}

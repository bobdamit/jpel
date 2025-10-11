/**
 * Utility to extract activity id from activity reference strings like 'a:activityId'.
 */
export function extractActivityId(activityRef: string | undefined): string {
  if (!activityRef) {
    throw new Error('Activity reference is undefined or null');
  }
  return activityRef.startsWith('a:') ? activityRef.substring(2) : activityRef;
}

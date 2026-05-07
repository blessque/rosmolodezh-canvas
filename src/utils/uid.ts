let counter = 0;

/**
 * Generate a unique ID for scene objects.
 * Uses a timestamp + incrementing counter for uniqueness within a session.
 */
export function uid(): string {
  counter += 1;
  return `obj_${Date.now().toString(36)}_${counter.toString(36)}`;
}

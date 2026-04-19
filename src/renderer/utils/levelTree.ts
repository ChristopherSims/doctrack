/**
 * LevelTree — DOORS-like hierarchical level utilities
 *
 * Level strings like "1", "1.1", "1.1.1" form a tree:
 *   "1"       -> depth 0 (root)
 *   "1.1"     -> depth 1 (child of "1")
 *   "1.1.1"   -> depth 2 (child of "1.1")
 *   "1.2"     -> depth 1 (child of "1")
 *   "2"       -> depth 0 (root)
 *
 * All operations are pure functions on arrays of level strings.
 */

/** Get the depth of a level string (0-indexed). "1" -> 0, "1.1" -> 1, "1.1.1" -> 2 */
export function getLevelDepth(level: string): number {
  if (!level) return 0;
  return level.split('.').length - 1;
}

/** Get the parent level string. "1.1.1" -> "1.1", "1.1" -> "1", "1" -> null */
export function getParentLevel(level: string): string | null {
  if (!level) return null;
  const parts = level.split('.');
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join('.');
}

/** Check if `childLevel` is a direct child of `parentLevel`. */
export function isDirectChild(childLevel: string, parentLevel: string): boolean {
  return getParentLevel(childLevel) === parentLevel;
}

/** Check if `descendant` is a descendant of `ancestor` (at any depth). */
export function isDescendantOf(descendant: string, ancestor: string): boolean {
  if (!descendant || !ancestor) return false;
  return descendant.startsWith(ancestor + '.');
}

/**
 * From an array of requirement levels, compute which levels are parents
 * (i.e., have at least one direct child in the list).
 */
export function getParentLevels(levels: string[]): Set<string> {
  const levelSet = new Set(levels);
  const parents = new Set<string>();
  for (const level of levels) {
    const parent = getParentLevel(level);
    if (parent && levelSet.has(parent)) {
      parents.add(parent);
    }
  }
  return parents;
}

/**
 * Get all direct child levels of `parentLevel` from the given list.
 */
export function getDirectChildLevels(parentLevel: string, levels: string[]): string[] {
  return levels.filter(l => isDirectChild(l, parentLevel));
}

/**
 * Filter a flat list of requirements based on which parent levels are expanded.
 * A row is visible if:
 *   1. It's a root-level item (depth 0), OR
 *  2. All of its ancestors are expanded
 */
export function filterVisibleRequirements<T extends { level?: string }>(
  requirements: T[],
  expandedLevels: Set<string>
): T[] {
  return requirements.filter(req => {
    const level = req.level || '1';
    const depth = getLevelDepth(level);
    if (depth === 0) return true;

    // Check all ancestors are expanded
    let current = level;
    while (true) {
      const parent = getParentLevel(current);
      if (!parent) break;
      if (!expandedLevels.has(parent)) return false;
      current = parent;
    }
    return true;
  });
}

/**
 * Compute the next available sub-level number for a given parent.
 * E.g., if parent="1" and existing children are ["1.1", "1.3"], returns "1.4".
 * If parent="" (root) and existing roots are ["1", "2"], returns "3".
 */
export function getNextSubLevel(parentLevel: string | null, existingLevels: string[]): string {
  if (parentLevel === null || parentLevel === '') {
    // Root level: find max top-level number
    const rootNumbers = existingLevels
      .filter(l => !l.includes('.'))
      .map(l => parseInt(l, 10))
      .filter(n => !isNaN(n));
    const max = rootNumbers.length > 0 ? Math.max(...rootNumbers) : 0;
    return String(max + 1);
  }

  // Sub-level: find children of parentLevel
  const prefix = parentLevel + '.';
  const childNumbers = existingLevels
    .filter(l => l.startsWith(prefix) && l.substring(prefix.length).indexOf('.') === -1)
    .map(l => parseInt(l.substring(prefix.length), 10))
    .filter(n => !isNaN(n));
  const max = childNumbers.length > 0 ? Math.max(...childNumbers) : 0;
  return `${parentLevel}.${max + 1}`;
}

/**
 * Compute all valid level options for a dropdown, organized hierarchically.
 * Returns flat list of level strings, sorted in tree order.
 * Includes existing levels plus "next available" placeholders for each parent.
 */
export function computeLevelOptions(existingLevels: string[]): string[] {
  const sorted = [...existingLevels].sort(levelComparator);
  const options: string[] = [];

  // Add all existing levels
  for (const level of sorted) {
    options.push(level);
  }

  // Add "next" option for root level
  options.push(getNextSubLevel(null, existingLevels));

  // Add "next" option for each parent that has children
  const parents = getParentLevels(existingLevels);
  for (const parent of parents) {
    options.push(getNextSubLevel(parent, existingLevels));
  }

  // Deduplicate and re-sort
  return [...new Set(options)].sort(levelComparator);
}

/**
 * Comparator for sorting level strings in tree-order.
 * "1" < "1.1" < "1.2" < "1.2.1" < "2"
 */
export function levelComparator(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  const maxLen = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLen; i++) {
    const aVal = aParts[i] ?? 0;
    const bVal = bParts[i] ?? 0;
    if (aVal !== bVal) return aVal - bVal;
  }
  return 0;
}

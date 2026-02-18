export function getParentPaths(path: string, includeSelf: boolean = false): string[] {
  const parts = path.split('/').filter(part => part !== '');
  const isAbsolute = path.startsWith('/');

  // If no parts (empty or root), handle edge cases
  if (parts.length === 0) {
    return path === '/' && includeSelf ? ['/'] : [];
  }

  // Determine how many segments to include
  const count = includeSelf ? parts.length : Math.max(0, parts.length - 1);

  return ["/", ...Array.from({ length: count }, (_, index) => {
    const segment = parts.slice(0, index + 1);
    return (isAbsolute ? '/' : '') + segment.join('/');
  })];
}
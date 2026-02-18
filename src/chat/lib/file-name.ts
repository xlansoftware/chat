/**
 * Generate a filename from a number and title
 * @param n - The number (will be padded to 3 digits)
 * @param title - The title to convert to filename-friendly format
 * @returns Generated filename in format: "###-slugified-title"
 */
export function generateFileName(n: number, title: string): string {
  // Pad number to 3 digits
  const paddedNumber = n.toString().padStart(3, '0');

  // Convert title to slug/filename-friendly format
  const slug = title
    .toLowerCase()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove special characters, keep alphanumeric and hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Remove multiple consecutive hyphens
    .replace(/-+/g, '-')
    // Trim hyphens from start and end
    .replace(/^-+|-+$/g, '')
    // Ensure slug isn't empty (fallback to 'untitled')
    .trim() || 'untitled';

  // Ensure slug has reasonable length (max 100 chars)
  const trimmedSlug = slug.length > 100 ? slug.substring(0, 100) : slug;

  return `${paddedNumber}-${trimmedSlug}`;
}

export function changeFileName(path: string, title: string): string {
  if (!title) return path;

  const nameParts = path.split("/");
  const oldName = nameParts.pop();
  if (!oldName) return path;

  nameParts.push(generateFileName(parseInt(oldName || "0"), title));
  const newName = nameParts.join("/");

  if (oldName.endsWith(".md")) return newName + ".md";

  return newName;
}
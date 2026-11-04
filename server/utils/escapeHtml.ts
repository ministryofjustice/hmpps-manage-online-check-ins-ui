// Escapes text for interpolation into an HTML string that a template outputs unescaped, such as a
// banner's `html`. Names and other values from upstream APIs must go through this.
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export default escapeHtml

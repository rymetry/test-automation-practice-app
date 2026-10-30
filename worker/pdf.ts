/**
 * Writes a one-page PDF with the given lines in Helvetica. No dependency: the file is a handful of objects
 * and a cross-reference table, which is all a PDF reader needs. Only ASCII is rendered; other characters become "?".
 */
export function simplePdf(lines: string[]): Uint8Array {
  const content = ['BT', '/F1 20 Tf', '72 770 Td', `(${pdfText(lines[0] ?? '')}) Tj`, '/F1 12 Tf', '0 -32 Td'];
  for (const line of lines.slice(1)) {
    content.push(`(${pdfText(line)}) Tj`, '0 -18 Td');
  }
  content.push('ET');
  const stream = content.join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return new TextEncoder().encode(body);
}

function pdfText(value: string): string {
  return value
    .replace(/[^\x20-\x7e]/g, '?')
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)');
}

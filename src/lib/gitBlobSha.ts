// Compute the git blob SHA-1 for a piece of text content.
// git blob sha = sha1("blob " + byteLength + "\0" + content)
// Lets us detect local changes vs the synced baseline without a network call.

const encoder = new TextEncoder();

export async function gitBlobSha(content: string): Promise<string> {
  const body = encoder.encode(content);
  const header = encoder.encode(`blob ${body.length}\0`);
  const full = new Uint8Array(header.length + body.length);
  full.set(header, 0);
  full.set(body, header.length);
  const digest = await crypto.subtle.digest('SHA-1', full);
  return hex(new Uint8Array(digest));
}

function hex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

// Payment-screenshot storage with selectable drivers (STORAGE_DRIVER env):
//   local  — saves into UPLOAD_DIR on the server (Node hosts: server/VPS,
//            cPanel, local dev). NOT persistent on Cloudflare Workers.
//   s3     — any S3-compatible bucket (AWS S3, Cloudflare R2, etc.) using
//            S3_* env vars. Works on Workers, Vercel and Node.
//   github — commits the image into a GitHub repo via the API (GITHUB_* env).
//
// Only real images are accepted: the file signature (magic bytes) must be
// PNG, JPEG or WebP, the size must be within limits, and the picture must
// have plausible screenshot dimensions. This is a basic sanity check — it
// cannot prove an image shows a payment, so orders are also reviewed by
// the admin and (when configured) by on-chain verification.

export interface StoredImage {
	driver: string;
	/** File name (local), object key or full URL (s3), raw URL (github). */
	ref: string;
	contentType: string;
}

export function detectImage(bytes: Uint8Array): { type: string; ext: string } | null {
	if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
		return { type: 'image/png', ext: 'png' };
	if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
		return { type: 'image/jpeg', ext: 'jpg' };
	if (
		bytes.length > 12 &&
		bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
		bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
	)
		return { type: 'image/webp', ext: 'webp' };
	return null;
}

export function imageDimensions(bytes: Uint8Array, type: string): { w: number; h: number } | null {
	try {
		if (type === 'image/png' && bytes.length > 24) {
			const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
			return { w: dv.getUint32(16), h: dv.getUint32(20) };
		}
		if (type === 'image/webp' && bytes.length > 30 && bytes[12] === 0x56 && bytes[13] === 0x50 && bytes[14] === 0x38 && bytes[15] === 0x58) {
			const w = 1 + ((bytes[27] << 8) | bytes[26]) + ((bytes[29] & 0x3f) << 16);
			const h = 1 + ((bytes[29] >> 2) | (bytes[28] << 6)) ;
			return { w, h: h > 0 ? h : 1 };
		}
		if (type === 'image/jpeg') {
			let i = 2;
			while (i < bytes.length - 9) {
				if (bytes[i] !== 0xff) { i++; continue; }
				const marker = bytes[i + 1];
				if (marker >= 0xc0 && marker <= 0xc3) {
					const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
					return { w: dv.getUint16(i + 7), h: dv.getUint16(i + 5) };
				}
				const len = (bytes[i + 2] << 8) | bytes[i + 3];
				i += 2 + len;
			}
		}
	} catch {
		return null;
	}
	return null;
}

export interface ImageCheck {
	ok: boolean;
	error?: string;
	type?: string;
	ext?: string;
}

/** Validate an uploaded file's bytes as a plausible screenshot image. */
export function validateScreenshot(bytes: Uint8Array, maxBytes: number): ImageCheck {
	if (bytes.length === 0) return { ok: false, error: 'The uploaded file is empty.' };
	if (bytes.length > maxBytes)
		return { ok: false, error: `Image is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).` };
	const detected = detectImage(bytes);
	if (!detected)
		return { ok: false, error: 'Only image files are accepted (PNG, JPG or WebP screenshot).' };
	const dims = imageDimensions(bytes, detected.type);
	if (dims && (dims.w < 120 || dims.h < 80))
		return { ok: false, error: 'That image is too small to be a payment screenshot. Please upload the full screenshot.' };
	return { ok: true, type: detected.type, ext: detected.ext };
}

type EnvGetter = (key: string) => string | undefined;

function toBase64(bytes: Uint8Array): string {
	let bin = '';
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(bin);
}

export async function storeImage(
	getEnv: EnvGetter,
	orderId: string,
	bytes: Uint8Array,
	ext: string,
	contentType: string,
): Promise<StoredImage> {
	const driver = (getEnv('STORAGE_DRIVER') ?? 'local').toLowerCase();
	const fileName = `${orderId}.${ext}`;

	if (driver === 's3' || driver === 'r2') {
		const { AwsClient } = await import('aws4fetch');
		const endpoint = (getEnv('S3_ENDPOINT') ?? '').replace(/\/$/, '');
		const bucket = getEnv('S3_BUCKET') ?? '';
		const region = getEnv('S3_REGION') ?? 'auto';
		const keyPrefix = (getEnv('S3_PREFIX') ?? 'payment-screenshots').replace(/^\/|\/$/g, '');
		const key = `${keyPrefix}/${fileName}`;
		const client = new AwsClient({
			accessKeyId: getEnv('S3_ACCESS_KEY_ID') ?? '',
			secretAccessKey: getEnv('S3_SECRET_ACCESS_KEY') ?? '',
			region,
			service: 's3',
		});
		const url = `${endpoint}/${bucket}/${key}`;
		const res = await client.fetch(url, {
			method: 'PUT',
			body: bytes as unknown as BodyInit,
			headers: { 'Content-Type': contentType },
		});
		if (!res.ok) throw new Error(`Storage upload failed (${res.status}).`);
		const publicBase = getEnv('S3_PUBLIC_BASE');
		return { driver, ref: publicBase ? `${publicBase.replace(/\/$/, '')}/${key}` : key, contentType };
	}

	if (driver === 'github') {
		const owner = getEnv('GITHUB_OWNER') ?? '';
		const repo = getEnv('GITHUB_REPO') ?? '';
		const branch = getEnv('GITHUB_BRANCH') ?? 'main';
		const dir = (getEnv('GITHUB_UPLOAD_DIR') ?? 'payment-screenshots').replace(/^\/|\/$/g, '');
		const path = `${dir}/${fileName}`;
		const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
			method: 'PUT',
			headers: {
				Authorization: `Bearer ${getEnv('GITHUB_TOKEN') ?? ''}`,
				Accept: 'application/vnd.github+json',
				'Content-Type': 'application/json',
				'User-Agent': 'ytcpm-payments',
			},
			body: JSON.stringify({
				message: `payment screenshot ${orderId}`,
				content: toBase64(bytes),
				branch,
			}),
		});
		if (!res.ok) throw new Error(`GitHub storage failed (${res.status}).`);
		// Store the repo path, not the download_url: on a private repo the
		// download_url carries a short-lived token and expires. The admin
		// screenshot endpoint fetches the file through the API instead.
		return { driver, ref: path, contentType };
	}

	// local (Node runtimes only)
	const fs = await import('node:fs/promises');
	const pathMod = await import('node:path');
	const dir = getEnv('UPLOAD_DIR') ?? 'uploads/payment-screenshots';
	await fs.mkdir(dir, { recursive: true });
	const full = pathMod.join(dir, fileName);
	await fs.writeFile(full, bytes);
	return { driver: 'local', ref: full, contentType };
}

export async function readLocalImage(ref: string): Promise<Uint8Array> {
	const fs = await import('node:fs/promises');
	return new Uint8Array(await fs.readFile(ref));
}

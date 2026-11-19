import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.B2_ENDPOINT || "https://s3.us-east-005.backblazeb2.com";
const region = process.env.B2_REGION || "us-east-005";
const accessKeyId = process.env.B2_KEY_ID;
const secretAccessKey = process.env.B2_APPLICATION_KEY;

export const B2_BUCKET_CLIPS = process.env.B2_BUCKET_CLIPS || "zclip-private-media-2026";
export const B2_BUCKET_EXPORTS = process.env.B2_BUCKET_EXPORTS || "zclip-private-media-2026";

let s3Client: S3Client | null = null;

export function getB2Client(): S3Client {
  if (!s3Client) {
    if (!accessKeyId || !secretAccessKey) {
      throw new Error("Backblaze B2 credentials (B2_KEY_ID, B2_APPLICATION_KEY) are not set.");
    }
    s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
      // Backblaze does not support the SDK's newer default checksum headers on presigned uploads.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return s3Client;
}

/**
 * Creates a presigned PUT URL for direct browser uploads.
 */
export async function getUploadPresignedUrl(
  bucket: string,
  key: string,
  contentType = "video/mp4",
  expiresIn = 900,
): Promise<string> {
  const client = getB2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Creates a presigned GET URL for downloading or streaming files.
 */
export async function getDownloadPresignedUrl(
  bucket: string,
  key: string,
  options?: { downloadName?: string; expiresIn?: number },
): Promise<string> {
  const client = getB2Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: options?.downloadName
      ? `attachment; filename="${options.downloadName}"`
      : undefined,
  });
  return getSignedUrl(client, command, { expiresIn: options?.expiresIn ?? 3600 });
}

/**
 * Uploads a buffer directly from the server (e.g. final rendered MP4).
 */
export async function uploadBuffer(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType = "video/mp4",
): Promise<void> {
  const client = getB2Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await client.send(command);
}

/**
 * Deletes objects from Backblaze B2.
 */
export async function deleteObjects(bucket: string, keys: string[]): Promise<void> {
  if (!keys.length) return;
  const client = getB2Client();
  if (keys.length === 1) {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: keys[0] }));
    return;
  }
  await client.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keys.map((k) => ({ Key: k })),
      },
    }),
  );
}


/**
 * Backblaze's dashboard presets only allow downloads. Browser uploads need a custom rule,
 * so the app sets it itself. It is safe to repeat, and is re-applied every few minutes so a
 * change made in the Backblaze dashboard cannot silently break uploads.
 */
let corsApplied = 0;
export async function ensureUploadCors(origins: string[], force = false): Promise<{ ok: boolean; code?: string }> {
  if (!force && Date.now() - corsApplied < 5 * 60_000) return { ok: true };
  try {
    await getB2Client().send(
      new PutBucketCorsCommand({
        Bucket: B2_BUCKET_CLIPS,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: origins,
              AllowedMethods: ["PUT", "GET", "HEAD"],
              AllowedHeaders: ["*"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
    corsApplied = Date.now();
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string };
    return { ok: false, code: `${err.name ?? "error"}: ${(err.message ?? "").slice(0, 80)}` };
  }
}

/** What the bucket currently allows (origins and methods only), for the health page. */
export async function readUploadCors(): Promise<{ origins: string[]; methods: string[] } | { error: string }> {
  try {
    const out = await getB2Client().send(new GetBucketCorsCommand({ Bucket: B2_BUCKET_CLIPS }));
    const rules = out.CORSRules ?? [];
    return {
      origins: rules.flatMap((r) => r.AllowedOrigins ?? []),
      methods: Array.from(new Set(rules.flatMap((r) => r.AllowedMethods ?? []))),
    };
  } catch (e: unknown) {
    return { error: (e as { name?: string }).name ?? "error" };
  }
}

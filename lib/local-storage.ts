import { randomUUID } from "node:crypto";
import { mkdir, opendir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const PRIVATE_UPLOADS_DIR_NAME = "private-uploads";
const projectRoot = process.cwd();

export const privateUploadsDirectory = path.join(projectRoot, PRIVATE_UPLOADS_DIR_NAME);

export type StoredLocalFile = {
  filename: string;
  filePath: string;
  bytes: number;
  mimeType: string;
};

async function ensurePrivateUploadsDirectory() {
  await mkdir(privateUploadsDirectory, { recursive: true });
}

function sanitizeExtension(originalFileName: string) {
  const extension = path.extname(originalFileName).toLowerCase();

  if (!extension || extension.length > 10) {
    return ".bin";
  }

  if (!/^[.][a-z0-9]+$/i.test(extension)) {
    return ".bin";
  }

  return extension;
}

export async function saveFormDataFileLocally(file: File) {
  await ensurePrivateUploadsDirectory();

  const extension = sanitizeExtension(file.name);
  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  const filePath = path.join(privateUploadsDirectory, filename);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await writeFile(filePath, buffer);

  const storedFile: StoredLocalFile = {
    filename,
    filePath,
    bytes: buffer.byteLength,
    mimeType: file.type || "application/octet-stream",
  };

  return storedFile;
}

export async function deleteLocalFile(filename: string) {
  await ensurePrivateUploadsDirectory();

  const absolutePath = path.join(privateUploadsDirectory, path.basename(filename));

  const details = await stat(absolutePath).catch(() => null);

  if (!details) {
    return {
      deleted: false,
      bytesFreed: 0,
    };
  }

  await unlink(absolutePath);

  return {
    deleted: true,
    bytesFreed: details.size,
  };
}

export async function getPrivateUploadsUsageBytes() {
  await ensurePrivateUploadsDirectory();

  let totalBytes = 0;

  async function walk(currentDirectory: string): Promise<void> {
    const directory = await opendir(currentDirectory);

    for await (const entry of directory) {
      const targetPath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        await walk(targetPath);
      } else if (entry.isFile()) {
        const fileStats = await stat(targetPath);
        totalBytes += fileStats.size;
      }
    }
  }

  await walk(privateUploadsDirectory);

  return totalBytes;
}

export function bytesToMegabytes(bytes: number) {
  return bytes / (1024 * 1024);
}

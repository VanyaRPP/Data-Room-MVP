import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as argon2 from "argon2";
import { rebuildSubtreeCounters } from "../src/nodes/subtree-sql";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@dataroom.app";
const DEMO_PASSWORD = "Demo1234!";
const DEMO_NAME = "Demo User";
const ROOM_NAME = "My Data Room";
const PDF_MIME_TYPE = "application/pdf";

const storage = createClient(
  requireEnv("SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
).storage.from(requireEnv("SUPABASE_BUCKET"));

/** Folder tree to create, and the PDFs to place in each folder. */
const LAYOUT: { path: string[]; files: string[] }[] = [
  { path: ["Financials"], files: ["financial-model.pdf", "cap-table.pdf"] },
  { path: ["Legal"], files: ["shareholders-agreement.pdf"] },
  { path: ["Product"], files: [] },
  { path: ["Product", "Roadmaps"], files: ["product-roadmap.pdf"] },
];

async function main(): Promise<void> {
  await resetDemoUser();

  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
  });
  const user = await prisma.user.create({
    data: { email: DEMO_EMAIL, passwordHash, name: DEMO_NAME },
  });

  const room = await prisma.dataRoom.create({
    data: { name: ROOM_NAME, ownerId: user.id },
  });
  const root = await prisma.node.create({
    data: { roomId: room.id, parentId: null, type: "FOLDER", name: ROOM_NAME },
  });
  await prisma.dataRoom.update({
    where: { id: room.id },
    data: { rootNodeId: root.id },
  });

  const folderIds = new Map<string, string>();
  let fileCount = 0;

  for (const { path, files } of LAYOUT) {
    const name = path[path.length - 1];
    const parentId = folderIds.get(path.slice(0, -1).join("/")) ?? root.id;
    if (!name) continue;

    const folder = await prisma.node.create({
      data: { roomId: room.id, parentId, type: "FOLDER", name },
    });
    folderIds.set(path.join("/"), folder.id);

    for (const file of files) {
      await seedFile(room.id, folder.id, file);
      fileCount += 1;
    }
  }

  // The seed writes rows directly rather than through the services that keep
  // the folder totals up to date, so it settles them once at the end.
  await rebuildSubtreeCounters(prisma);

  console.log(
    `Seeded ${DEMO_EMAIL} (password: ${DEMO_PASSWORD}) with ${LAYOUT.length} folders and ${fileCount} files`,
  );
}

/**
 * Uploads one fixture PDF and records it as a READY file.
 *
 * This is the same shape the presign/complete flow produces - same storage key
 * convention, same status - so seeded files behave identically to uploaded
 * ones rather than being a special case the app has to tolerate.
 */
async function seedFile(
  roomId: string,
  folderId: string,
  fileName: string,
): Promise<void> {
  const body = readFileSync(join(__dirname, "seed-assets", fileName));
  const nodeId = randomUUID();
  const storageKey = `rooms/${roomId}/${nodeId}.pdf`;

  const { error } = await storage.upload(storageKey, body, {
    contentType: PDF_MIME_TYPE,
    upsert: true,
  });
  if (error) {
    throw new Error(`Could not upload ${fileName}: ${error.message}`);
  }

  await prisma.node.create({
    data: {
      id: nodeId,
      roomId,
      parentId: folderId,
      type: "FILE",
      name: fileName,
      size: BigInt(body.byteLength),
      mimeType: PDF_MIME_TYPE,
      storageKey,
      status: "READY",
    },
  });
}

/**
 * Makes the seed re-runnable. Deleting the DataRoom cascades to every Node,
 * Share and ShareGrant beneath it (see schema.prisma), but storage knows
 * nothing about that cascade - so the blobs are collected and removed first.
 */
async function resetDemoUser(): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
  });
  if (!existing) return;

  const staleFiles = await prisma.node.findMany({
    where: { room: { ownerId: existing.id }, storageKey: { not: null } },
    select: { storageKey: true },
  });
  const staleKeys = staleFiles
    .map((file) => file.storageKey)
    .filter((key): key is string => key !== null);

  if (staleKeys.length > 0) {
    const { error } = await storage.remove(staleKeys);
    if (error) {
      console.warn(`Could not remove ${staleKeys.length} old file(s): ${error.message}`);
    }
  }

  await prisma.dataRoom.deleteMany({ where: { ownerId: existing.id } });
  await prisma.user.delete({ where: { id: existing.id } });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set - see apps/api/.env.example`);
  return value;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());

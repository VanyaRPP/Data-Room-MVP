import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@dataroom.app";
const DEMO_PASSWORD = "Demo1234!";
const DEMO_NAME = "Demo User";
const ROOM_NAME = "My Data Room";

async function main(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    // Deterministic reseed: DataRoom -> Node/Share/ShareGrant all cascade
    // from here (see schema.prisma), so this is enough to fully clean up
    // the demo user's previous data before recreating it below.
    await prisma.dataRoom.deleteMany({ where: { ownerId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });
  const user = await prisma.user.create({
    data: { email: DEMO_EMAIL, passwordHash, name: DEMO_NAME },
  });

  const room = await prisma.dataRoom.create({
    data: { name: ROOM_NAME, ownerId: user.id },
  });

  const root = await prisma.node.create({
    data: { roomId: room.id, parentId: null, type: "FOLDER", name: ROOM_NAME },
  });
  await prisma.dataRoom.update({ where: { id: room.id }, data: { rootNodeId: root.id } });

  await prisma.node.create({
    data: { roomId: room.id, parentId: root.id, type: "FOLDER", name: "Financials" },
  });
  await prisma.node.create({
    data: { roomId: room.id, parentId: root.id, type: "FOLDER", name: "Legal" },
  });
  const product = await prisma.node.create({
    data: { roomId: room.id, parentId: root.id, type: "FOLDER", name: "Product" },
  });
  await prisma.node.create({
    data: { roomId: room.id, parentId: product.id, type: "FOLDER", name: "Roadmaps" },
  });

  console.log(`Seeded ${DEMO_EMAIL} (password: ${DEMO_PASSWORD})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());

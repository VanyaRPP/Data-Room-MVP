import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { findCounterDrift } from '../src/nodes/subtree-sql';

/**
 * Compares every folder's stored totals against what the tree actually holds.
 *
 * The counters on Node are an optimisation - they let a listing show a folder's
 * size without a recursive query per row - and the price of that is a number
 * which is only correct while every write path maintains it. This recomputes
 * the truth from the tree and reports anything that has drifted, which is both
 * how the counters are tested and how drift would be caught in production.
 *
 * Run with: pnpm --filter api counters:check
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const drifted = await findCounterDrift(prisma);
  const total = await prisma.node.count();

  if (drifted.length === 0) {
    console.log(`All ${total} nodes agree with the tree.`);
    return;
  }

  console.error(`${drifted.length} of ${total} nodes have drifted:`);
  for (const row of drifted) {
    console.error(
      `  ${row.name} (${row.id})\n` +
        `    bytes:   stored ${row.storedBytes}  actual ${row.actualBytes}\n` +
        `    files:   stored ${row.storedFiles}  actual ${row.actualFiles}\n` +
        `    folders: stored ${row.storedFolders}  actual ${row.actualFolders}`,
    );
  }
  process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());

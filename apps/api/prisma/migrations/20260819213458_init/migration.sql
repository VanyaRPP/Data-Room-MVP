-- CreateEnum
CREATE TYPE "NodeType" AS ENUM ('FOLDER', 'FILE');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('UPLOADING', 'READY');

-- CreateEnum
CREATE TYPE "ShareMode" AS ENUM ('PUBLIC', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "ShareRole" AS ENUM ('VIEWER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataRoom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rootNodeId" TEXT,

    CONSTRAINT "DataRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" "NodeType" NOT NULL,
    "name" TEXT NOT NULL,
    "size" BIGINT,
    "mimeType" TEXT,
    "storageKey" TEXT,
    "status" "FileStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Share" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "mode" "ShareMode" NOT NULL,
    "token" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareGrant" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "role" "ShareRole" NOT NULL DEFAULT 'VIEWER',

    CONSTRAINT "ShareGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DataRoom_rootNodeId_key" ON "DataRoom"("rootNodeId");

-- CreateIndex
CREATE INDEX "DataRoom_ownerId_idx" ON "DataRoom"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Node_storageKey_key" ON "Node"("storageKey");

-- CreateIndex
CREATE INDEX "Node_parentId_idx" ON "Node"("parentId");

-- CreateIndex
CREATE INDEX "Node_roomId_idx" ON "Node"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "Share_token_key" ON "Share"("token");

-- CreateIndex
CREATE INDEX "Share_nodeId_idx" ON "Share"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareGrant_shareId_email_key" ON "ShareGrant"("shareId", "email");

-- AddForeignKey
ALTER TABLE "DataRoom" ADD CONSTRAINT "DataRoom_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "DataRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareGrant" ADD CONSTRAINT "ShareGrant_shareId_fkey" FOREIGN KEY ("shareId") REFERENCES "Share"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareGrant" ADD CONSTRAINT "ShareGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma schema cannot express functional indexes, so these are hand-written.

-- Case-insensitive sibling name uniqueness: "Report.pdf" and "report.pdf" in the
-- same folder must conflict. A plain @@unique([parentId, name]) would allow both.
CREATE UNIQUE INDEX "node_parent_name_ci" ON "Node" ("parentId", lower("name"));

-- Covers the keyset-paginated children listing (folders before files, then
-- name, then id as tiebreaker) without a sort step.
CREATE INDEX "node_children_listing" ON "Node" ("parentId",
  (CASE WHEN "type" = 'FOLDER' THEN 0 ELSE 1 END), lower("name"), "id");

-- AlterTable
ALTER TABLE "Node" ADD COLUMN     "pendingStorageKey" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;
-- CreateTable
CREATE TABLE "FileVersion" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "size" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FileVersion_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "FileVersion_storageKey_key" ON "FileVersion"("storageKey");
-- CreateIndex
CREATE INDEX "FileVersion_nodeId_idx" ON "FileVersion"("nodeId");
-- CreateIndex
CREATE UNIQUE INDEX "FileVersion_nodeId_version_key" ON "FileVersion"("nodeId", "version");
-- CreateIndex
CREATE UNIQUE INDEX "Node_pendingStorageKey_key" ON "Node"("pendingStorageKey");
-- AddForeignKey
ALTER TABLE "FileVersion" ADD CONSTRAINT "FileVersion_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;

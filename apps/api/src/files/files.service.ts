import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MAX_FILE_SIZE_BYTES,
  PDF_MIME_TYPE,
  VIEW_URL_TTL_SECONDS,
  type FileUrlDto,
  type FileVersionDto,
  type NodeDto,
  type PresignInput,
  type PresignedFileDto,
  type UploadConflictsDto,
  type UploadConflictsInput,
} from '@dataroom/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService, type OwnedNode } from '../access/access.service';
import { NameConflictService } from '../nodes/name-conflict.service';
import { toNodeDto } from '../nodes/node-dto';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly nameConflict: NameConflictService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Reserves a node per file and hands back a URL to upload the bytes to.
   *
   * Deliberately sequential: each name is resolved against siblings that
   * already exist, so creating each node before resolving the next one is what
   * makes a batch of identically named files land as `report.pdf`,
   * `report (1).pdf`, `report (2).pdf` instead of colliding with each other.
   * Results come back in request order so the client can pair them up.
   */
  async presign(
    input: PresignInput,
    userId: string,
  ): Promise<PresignedFileDto[]> {
    const folder = await this.access.requireOwnedFolder(input.folderId, userId);
    const presigned: PresignedFileDto[] = [];

    for (const file of input.files) {
      const existing =
        input.onConflict === 'version'
          ? await this.nameConflict.findConflict(folder.id, file.name)
          : null;

      presigned.push(
        existing?.type === 'FILE'
          ? await this.reserveNewVersion(existing.id, file.name, userId)
          : await this.reserveNewFile(folder.id, folder.roomId, file.name),
      );
    }

    return presigned;
  }

  /** A brand new file, with its name suffixed around any clash. */
  private async reserveNewFile(
    folderId: string,
    roomId: string,
    requestedName: string,
  ): Promise<PresignedFileDto> {
    const finalName = await this.nameConflict.resolveAvailableName(
      folderId,
      requestedName,
    );

    // The id is generated up front so the storage key can be derived from it
    // in the same insert, keeping key and row in lockstep.
    const nodeId = randomUUID();
    const storageKey = `rooms/${roomId}/${nodeId}.pdf`;

    await this.prisma.node.create({
      data: {
        id: nodeId,
        roomId,
        parentId: folderId,
        type: 'FILE',
        name: finalName,
        mimeType: PDF_MIME_TYPE,
        storageKey,
        // Stays out of listings until /complete confirms the bytes arrived.
        status: 'UPLOADING',
      },
    });

    return {
      nodeId,
      finalName,
      uploadUrl: await this.storage.createUploadUrl(storageKey),
      action: finalName === requestedName ? 'created' : 'renamed',
    };
  }

  /**
   * Replacement bytes for a file that already exists.
   *
   * Nothing about the file changes yet: the incoming key is parked on the node
   * and only takes over in /complete, so a failed upload leaves the current
   * version serving exactly as before.
   */
  private async reserveNewVersion(
    nodeId: string,
    name: string,
    userId: string,
  ): Promise<PresignedFileDto> {
    const node = await this.access.requireOwnedNode(nodeId, userId);
    const nextVersion = node.version + 1;
    const storageKey = `rooms/${node.roomId}/${nodeId}/v${nextVersion}.pdf`;

    await this.prisma.node.update({
      where: { id: nodeId },
      data: { pendingStorageKey: storageKey },
    });

    return {
      nodeId,
      finalName: name,
      uploadUrl: await this.storage.createUploadUrl(storageKey),
      action: 'versioned',
    };
  }

  /**
   * Confirms an upload actually landed and publishes the file.
   *
   * The size and content type are read back from storage rather than trusted
   * from the client, and the node is only listed once this succeeds. Repeat
   * calls are harmless, which matters because a retry may race the first
   * response.
   */
  async complete(fileId: string, userId: string): Promise<NodeDto> {
    const node = await this.access.requireOwnedNode(fileId, userId);
    const currentKey = requireFileStorageKey(node);

    // A replacement was uploaded: verify it, then swap it in.
    if (node.pendingStorageKey) {
      return this.promotePendingVersion(node, node.pendingStorageKey);
    }

    if (node.status === 'READY') return toNodeDto(node);

    const object = await this.verifyUpload(currentKey, () =>
      this.discard(node.id, currentKey),
    );

    const ready = await this.prisma.node.update({
      where: { id: node.id },
      data: { status: 'READY', size: BigInt(object.size) },
    });

    return toNodeDto(ready);
  }

  /**
   * Makes the uploaded replacement current and files the outgoing bytes away
   * as history.
   *
   * One transaction, because a half-applied swap is the one outcome that would
   * actually lose data: the archive row and the node's new pointer have to
   * land together or not at all.
   */
  private async promotePendingVersion(
    node: OwnedNode,
    pendingKey: string,
  ): Promise<NodeDto> {
    const currentKey = requireFileStorageKey(node);

    const object = await this.verifyUpload(pendingKey, async () => {
      await this.prisma.node.update({
        where: { id: node.id },
        data: { pendingStorageKey: null },
      });
      await this.storage.removeMany([pendingKey]);
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.fileVersion.create({
        data: {
          nodeId: node.id,
          version: node.version,
          size: node.size ?? BigInt(0),
          mimeType: node.mimeType ?? PDF_MIME_TYPE,
          storageKey: currentKey,
        },
      });

      return tx.node.update({
        where: { id: node.id },
        data: {
          version: node.version + 1,
          storageKey: pendingKey,
          pendingStorageKey: null,
          size: BigInt(object.size),
          status: 'READY',
        },
      });
    });

    return toNodeDto(updated);
  }

  /**
   * Reads back what actually landed in storage. The client is never trusted
   * for size or type - it uploaded straight to the bucket, so this is the
   * first moment the server sees the bytes at all.
   */
  private async verifyUpload(
    storageKey: string,
    discard: () => Promise<void>,
  ): Promise<{ size: number }> {
    const object = await this.storage.findObject(storageKey);
    if (!object) {
      throw new BadRequestException('The upload did not finish. Try again.');
    }

    if (object.size > MAX_FILE_SIZE_BYTES) {
      await discard();
      throw new BadRequestException('Files must be 50 MB or smaller');
    }

    if (object.contentType !== PDF_MIME_TYPE) {
      await discard();
      throw new BadRequestException('Only PDF files can be uploaded');
    }

    return object;
  }

  /** Which of these names a file in the folder already uses. */
  async findTakenNames(
    input: UploadConflictsInput,
    userId: string,
  ): Promise<UploadConflictsDto> {
    const folder = await this.access.requireOwnedFolder(input.folderId, userId);

    const taken: string[] = [];
    for (const name of input.names) {
      const conflict = await this.nameConflict.findConflict(folder.id, name);
      if (conflict?.type === 'FILE') taken.push(name);
    }

    return { taken };
  }

  /** A file's history, newest first, with the current version at the top. */
  async listVersions(
    fileId: string,
    userId: string,
  ): Promise<FileVersionDto[]> {
    const node = await this.access.requireOwnedNode(fileId, userId);
    requireFileStorageKey(node);

    const archived = await this.prisma.fileVersion.findMany({
      where: { nodeId: node.id },
      orderBy: { version: 'desc' },
    });

    return [
      {
        version: node.version,
        size: (node.size ?? BigInt(0)).toString(),
        createdAt: node.updatedAt.toISOString(),
        isCurrent: true,
      },
      ...archived.map((version) => ({
        version: version.version,
        size: version.size.toString(),
        createdAt: version.createdAt.toISOString(),
        isCurrent: false,
      })),
    ];
  }

  /** A short-lived URL for viewing one specific version. */
  async createVersionUrl(
    fileId: string,
    version: number,
    userId: string,
  ): Promise<FileUrlDto> {
    const node = await this.access.requireOwnedNode(fileId, userId);
    const currentKey = requireFileStorageKey(node);

    let storageKey = currentKey;
    if (version !== node.version) {
      const archived = await this.prisma.fileVersion.findUnique({
        where: { nodeId_version: { nodeId: node.id, version } },
      });
      if (!archived) throw new NotFoundException('Version not found');
      storageKey = archived.storageKey;
    }

    return this.signView(storageKey);
  }

  /** A short-lived URL for viewing the file inline. */
  async createViewUrl(fileId: string, userId: string): Promise<FileUrlDto> {
    const node = await this.access.requireOwnedNode(fileId, userId);
    const storageKey = requireFileStorageKey(node);

    if (node.status !== 'READY') {
      throw new BadRequestException('This file is still uploading');
    }

    return this.signView(storageKey);
  }

  private async signView(storageKey: string): Promise<FileUrlDto> {
    const url = await this.storage.createViewUrl(
      storageKey,
      VIEW_URL_TTL_SECONDS,
    );

    return {
      url,
      expiresAt: new Date(
        Date.now() + VIEW_URL_TTL_SECONDS * 1000,
      ).toISOString(),
    };
  }

  /** Drops a rejected upload, row and blob alike. */
  private async discard(nodeId: string, storageKey: string): Promise<void> {
    await this.prisma.node.delete({ where: { id: nodeId } });
    await this.storage.removeMany([storageKey]);
  }
}

function requireFileStorageKey(node: OwnedNode): string {
  if (node.type !== 'FILE' || !node.storageKey) {
    throw new BadRequestException('That item is not a file');
  }
  return node.storageKey;
}

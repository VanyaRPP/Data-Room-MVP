import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  MAX_FILE_SIZE_BYTES,
  PDF_MIME_TYPE,
  VIEW_URL_TTL_SECONDS,
  type FileUrlDto,
  type NodeDto,
  type PresignInput,
  type PresignedFileDto,
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
      const finalName = await this.nameConflict.resolveAvailableName(
        folder.id,
        file.name,
      );

      // The id is generated up front so the storage key can be derived from it
      // in the same insert, keeping key and row in lockstep.
      const nodeId = randomUUID();
      const storageKey = `rooms/${folder.roomId}/${nodeId}.pdf`;

      await this.prisma.node.create({
        data: {
          id: nodeId,
          roomId: folder.roomId,
          parentId: folder.id,
          type: 'FILE',
          name: finalName,
          size: BigInt(file.size),
          mimeType: PDF_MIME_TYPE,
          storageKey,
          // Stays out of listings until /complete confirms the bytes arrived.
          status: 'UPLOADING',
        },
      });

      presigned.push({
        nodeId,
        finalName,
        uploadUrl: await this.storage.createUploadUrl(storageKey),
      });
    }

    return presigned;
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
    const storageKey = requireFileStorageKey(node);

    if (node.status === 'READY') return toNodeDto(node);

    const object = await this.storage.findObject(storageKey);
    if (!object) {
      throw new BadRequestException('The upload did not finish. Try again.');
    }

    if (object.size > MAX_FILE_SIZE_BYTES) {
      await this.discard(node.id, storageKey);
      throw new BadRequestException('Files must be 50 MB or smaller');
    }

    // The bytes were uploaded straight to storage, so this is the first point
    // the server can check what was actually stored.
    if (object.contentType !== PDF_MIME_TYPE) {
      await this.discard(node.id, storageKey);
      throw new BadRequestException('Only PDF files can be uploaded');
    }

    const ready = await this.prisma.node.update({
      where: { id: node.id },
      data: { status: 'READY', size: BigInt(object.size) },
    });

    return toNodeDto(ready);
  }

  /** A short-lived URL for viewing the file inline. */
  async createViewUrl(fileId: string, userId: string): Promise<FileUrlDto> {
    const node = await this.access.requireOwnedNode(fileId, userId);
    const storageKey = requireFileStorageKey(node);

    if (node.status !== 'READY') {
      throw new BadRequestException('This file is still uploading');
    }

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

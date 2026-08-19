import { BadRequestException, Injectable } from '@nestjs/common';
import {
  VIEW_URL_TTL_SECONDS,
  type BreadcrumbDto,
  type ChildrenQuery,
  type FileUrlDto,
  type NodePage,
  type PublicShareDto,
} from '@dataroom/shared';
import { AccessService, type ShareViewer } from '../access/access.service';
import { NodeQueriesService } from '../nodes/node-queries.service';
import { toNodeDto } from '../nodes/node-dto';
import { StorageService } from '../storage/storage.service';

/**
 * The read-only half of the app, reached with a share token instead of
 * ownership.
 *
 * Every method re-resolves the token: access can be revoked at any moment, and
 * a visitor with the page already open must be stopped at their next request
 * rather than trusted for the rest of the session.
 */
@Injectable()
export class PublicService {
  constructor(
    private readonly access: AccessService,
    private readonly queries: NodeQueriesService,
    private readonly storage: StorageService,
  ) {}

  async describe(token: string, viewer: ShareViewer): Promise<PublicShareDto> {
    const share = await this.access.requireActiveShare(token, viewer);

    return {
      token: share.token,
      mode: share.mode,
      sharedBy: share.createdBy.name,
      // Reported as a root: whatever sits above it belongs to the owner's room
      // and is unreachable through this link, so naming its parent would only
      // hand out an id the visitor can do nothing with.
      root: { ...toNodeDto(share.node), parentId: null },
    };
  }

  async listChildren(
    token: string,
    nodeId: string,
    query: ChildrenQuery,
    viewer: ShareViewer,
  ): Promise<NodePage> {
    const { node } = await this.access.requireSharedNode(token, nodeId, viewer);

    if (node.type !== 'FOLDER') {
      throw new BadRequestException('That target is a file, not a folder');
    }

    return this.queries.listChildren(node.id, query);
  }

  /**
   * The trail stops at whatever was shared. Anything above it belongs to the
   * owner's room and is none of the visitor's business.
   */
  async breadcrumbs(
    token: string,
    nodeId: string,
    viewer: ShareViewer,
  ): Promise<BreadcrumbDto[]> {
    const { share, node } = await this.access.requireSharedNode(
      token,
      nodeId,
      viewer,
    );

    return this.queries.breadcrumbs(node.id, share.nodeId);
  }

  async createViewUrl(
    token: string,
    fileId: string,
    viewer: ShareViewer,
  ): Promise<FileUrlDto> {
    const { node } = await this.access.requireSharedNode(token, fileId, viewer);

    if (node.type !== 'FILE' || !node.storageKey) {
      throw new BadRequestException('That item is not a file');
    }
    if (node.status !== 'READY') {
      throw new BadRequestException('This file is still uploading');
    }

    const url = await this.storage.createViewUrl(
      node.storageKey,
      VIEW_URL_TTL_SECONDS,
    );

    return {
      url,
      expiresAt: new Date(
        Date.now() + VIEW_URL_TTL_SECONDS * 1000,
      ).toISOString(),
    };
  }
}

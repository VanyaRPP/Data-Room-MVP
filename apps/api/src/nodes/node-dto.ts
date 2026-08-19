import type { FileStatus, NodeDto, NodeType } from '@dataroom/shared';

/**
 * The columns every node DTO is built from. Both Prisma model objects and the
 * rows of the raw listing query satisfy this, so one mapper serves both.
 */
export interface NodeRowShape {
  id: string;
  parentId: string | null;
  type: NodeType;
  name: string;
  size: bigint | null;
  mimeType: string | null;
  status: FileStatus | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toNodeDto(node: NodeRowShape): NodeDto {
  return {
    id: node.id,
    parentId: node.parentId,
    type: node.type,
    name: node.name,
    // bigint and Date have no JSON representation; convert here so the DTO is
    // exactly what goes over the wire rather than relying on the serializer.
    size: node.size === null ? null : node.size.toString(),
    mimeType: node.mimeType,
    status: node.status,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
  };
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  apiErrorShape,
  fileUrlDtoSchema,
  fileUrlQuerySchema,
  fileVersionDtoSchema,
  nodeDtoSchema,
  presignSchema,
  presignedFileDtoSchema,
  uploadConflictsDtoSchema,
  uploadConflictsSchema,
  type FileUrlDto,
  type FileUrlQuery,
  type FileVersionDto,
  type NodeDto,
  type PresignInput,
  type PresignedFileDto,
  type UploadConflictsDto,
  type UploadConflictsInput,
} from '@dataroom/shared';
import {
  ApiZodArrayResponse,
  ApiZodBody,
  ApiZodQuery,
  ApiZodResponse,
} from '../common/api-docs';
import { zodPipe } from '../common/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../auth/decorators';
import { FilesService } from './files.service';

@ApiTags('Files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presign')
  @ApiOperation({
    summary: 'Reserve upload slots and get URLs to PUT the bytes to',
    description:
      'File bytes never pass through this API. Each slot returns a signed URL ' +
      'to PUT the file to directly, with `Content-Type: application/pdf` - ' +
      'storage records whatever is sent, and the wrong type is rejected on ' +
      'completion. Results come back in request order. A name already in use ' +
      'is suffixed by default; `onConflict: "version"` replaces the existing ' +
      'file instead and keeps the old bytes as history.',
  })
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(presignSchema)
  @ApiZodArrayResponse(200, presignedFileDtoSchema, 'One slot per file')
  presign(
    @Body(zodPipe(presignSchema)) body: PresignInput,
    @CurrentUser() user: RequestUser,
  ): Promise<PresignedFileDto[]> {
    return this.filesService.presign(body, user.id);
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Confirm the bytes landed and publish the file',
    description:
      'Reads the size and content type back from storage rather than trusting ' +
      'the client, and only then makes the file visible in listings. When a ' +
      'replacement was uploaded, this is the moment it becomes current and ' +
      'the outgoing bytes are filed away as a version. Safe to call twice.',
  })
  @HttpCode(HttpStatus.OK)
  @ApiZodResponse(200, nodeDtoSchema, 'The published file')
  @ApiZodResponse(
    400,
    apiErrorShape,
    'Upload incomplete, too large, or not a PDF',
  )
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<NodeDto> {
    return this.filesService.complete(id, user.id);
  }

  @Get(':id/url')
  @ApiOperation({
    summary: 'A short-lived URL for viewing or downloading the file',
    description:
      'Valid for ten minutes and served inline by default. `download=true` ' +
      'asks storage to offer it as a file named after the node, since the ' +
      'stored object is keyed by id and would otherwise save as a UUID.',
  })
  @ApiZodQuery(fileUrlQuerySchema)
  @ApiZodResponse(200, fileUrlDtoSchema, 'Signed URL and its expiry')
  url(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(zodPipe(fileUrlQuerySchema)) query: FileUrlQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<FileUrlDto> {
    return this.filesService.createViewUrl(id, user.id, query);
  }

  @Post('conflicts')
  @ApiOperation({
    summary: 'Which of these names a file already uses',
    description:
      'Asked before uploading, so the choice between keeping both and ' +
      'replacing can be put to the user before any bytes move.',
  })
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(uploadConflictsSchema)
  @ApiZodResponse(200, uploadConflictsDtoSchema, 'The names already taken')
  conflicts(
    @Body(zodPipe(uploadConflictsSchema)) body: UploadConflictsInput,
    @CurrentUser() user: RequestUser,
  ): Promise<UploadConflictsDto> {
    return this.filesService.findTakenNames(body, user.id);
  }

  @Get(':id/versions')
  @ApiOperation({
    summary: "A file's history, newest first",
    description: 'The current version is always the first entry.',
  })
  @ApiZodArrayResponse(200, fileVersionDtoSchema, 'Versions, newest first')
  versions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<FileVersionDto[]> {
    return this.filesService.listVersions(id, user.id);
  }

  @Get(':id/versions/:version/url')
  @ApiOperation({
    summary: 'A short-lived URL for one specific version',
    description:
      'With `download=true` the saved copy is named `report (v2).pdf`, since ' +
      'every version of a file shares one name.',
  })
  @ApiZodQuery(fileUrlQuerySchema)
  @ApiZodResponse(200, fileUrlDtoSchema, 'Signed URL and its expiry')
  @ApiZodResponse(404, apiErrorShape, 'No such version')
  versionUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
    @Query(zodPipe(fileUrlQuerySchema)) query: FileUrlQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<FileUrlDto> {
    return this.filesService.createVersionUrl(id, version, user.id, query);
  }
}

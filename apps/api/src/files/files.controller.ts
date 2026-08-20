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
} from '@nestjs/common';
import {
  presignSchema,
  uploadConflictsSchema,
  type FileUrlDto,
  type FileVersionDto,
  type NodeDto,
  type PresignInput,
  type PresignedFileDto,
  type UploadConflictsDto,
  type UploadConflictsInput,
} from '@dataroom/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../auth/decorators';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presign')
  @HttpCode(HttpStatus.OK)
  presign(
    @Body(zodPipe(presignSchema)) body: PresignInput,
    @CurrentUser() user: RequestUser,
  ): Promise<PresignedFileDto[]> {
    return this.filesService.presign(body, user.id);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<NodeDto> {
    return this.filesService.complete(id, user.id);
  }

  @Get(':id/url')
  url(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<FileUrlDto> {
    return this.filesService.createViewUrl(id, user.id);
  }

  @Post('conflicts')
  @HttpCode(HttpStatus.OK)
  conflicts(
    @Body(zodPipe(uploadConflictsSchema)) body: UploadConflictsInput,
    @CurrentUser() user: RequestUser,
  ): Promise<UploadConflictsDto> {
    return this.filesService.findTakenNames(body, user.id);
  }

  @Get(':id/versions')
  versions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<FileVersionDto[]> {
    return this.filesService.listVersions(id, user.id);
  }

  @Get(':id/versions/:version/url')
  versionUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() user: RequestUser,
  ): Promise<FileUrlDto> {
    return this.filesService.createVersionUrl(id, version, user.id);
  }
}

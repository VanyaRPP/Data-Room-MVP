import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  presignSchema,
  type FileUrlDto,
  type NodeDto,
  type PresignInput,
  type PresignedFileDto,
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
}

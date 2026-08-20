import { Controller, Get, Query } from '@nestjs/common';
import {
  searchQuerySchema,
  type SearchPage,
  type SearchQuery,
} from '@dataroom/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../auth/decorators';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @Query(zodPipe(searchQuerySchema)) query: SearchQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<SearchPage> {
    return this.searchService.search(query, user.id);
  }
}

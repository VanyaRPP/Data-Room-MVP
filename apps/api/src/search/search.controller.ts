import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  searchPageSchema,
  searchQuerySchema,
  type SearchPage,
  type SearchQuery,
} from '@dataroom/shared';
import { ApiZodQuery, ApiZodResponse } from '../common/api-docs';
import { zodPipe } from '../common/zod-validation.pipe';
import { CurrentUser, type RequestUser } from '../auth/decorators';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Find files and folders by name, anywhere in your rooms',
    description:
      'Matches anywhere in the name, case-insensitively. Names starting with ' +
      'the query rank first. Each result carries its path, since two files ' +
      'can share a name. Paged with the same opaque cursor as listings.',
  })
  @ApiZodQuery(searchQuerySchema)
  @ApiZodResponse(200, searchPageSchema, 'One page of matches')
  search(
    @Query(zodPipe(searchQuerySchema)) query: SearchQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<SearchPage> {
    return this.searchService.search(query, user.id);
  }
}

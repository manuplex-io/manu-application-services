import { tavily } from '@tavily/core';
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class TavilySearchService implements OnModuleInit {
  async onModuleInit() {}

  tavilyClient = tavily({
    apiKey: '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',
  });

  async tavilySearch(input: any, options: any) {
    const response = await this.tavilyClient.search(input, options);
    return response;
  }

  async tavilySearchShort(input: any, options: any) {
    const response = await this.tavilyClient.searchQNA(input, options);
    return response;
  }
}

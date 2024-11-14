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

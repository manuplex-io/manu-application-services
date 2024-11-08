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
}

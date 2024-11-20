import { forwardRef, Module } from '@nestjs/common';
import { OrderFormService } from './orderform.service';
import { KafkaOb1Module } from 'src/kafka-ob1/kafka-ob1.module';
import { FindSupplierService } from './find-supplier.service';
import { SuggestionService } from './suggestion.service';
import { TavilySearchService } from './tavily-search.service';
import { ShortlistSupplierService } from './shortlist-supplier.service';
import { GoogleSheetService } from './google-sheet.service';
import { SlackChannelService } from './slack-channel-service';

@Module({
  imports: [forwardRef(() => KafkaOb1Module)],
  providers: [
    OrderFormService,
    FindSupplierService,
    SuggestionService,
    TavilySearchService,
    ShortlistSupplierService,
    GoogleSheetService,
    SlackChannelService
  ],
  exports: [
    OrderFormService,
    FindSupplierService,
    SuggestionService,
    TavilySearchService,
    ShortlistSupplierService,
    GoogleSheetService,
    SlackChannelService
  ],
})
export class ServicesModule {}

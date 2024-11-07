import { forwardRef, Module } from '@nestjs/common';
import { OrderFormService } from './orderform.service';
import { KafkaOb1Module } from 'src/kafka-ob1/kafka-ob1.module';
import { FindSupplierService } from './find-supplier.service';
import { SuggestionService } from './suggestion.service';

@Module({
  imports: [forwardRef(() => KafkaOb1Module)],
  providers: [OrderFormService, FindSupplierService,SuggestionService],
  exports: [OrderFormService, FindSupplierService,SuggestionService],
})
export class ServicesModule {}

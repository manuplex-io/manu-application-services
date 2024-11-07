import { forwardRef, Module } from '@nestjs/common';
import { OrderFormService } from './orderform.service';
import { KafkaOb1Module } from 'src/kafka-ob1/kafka-ob1.module';
import { FindSupplierService } from './find-supplier.service';

@Module({
  imports: [forwardRef(() => KafkaOb1Module)],
  providers: [OrderFormService, FindSupplierService],
  exports: [OrderFormService, FindSupplierService],
})
export class ServicesModule {}

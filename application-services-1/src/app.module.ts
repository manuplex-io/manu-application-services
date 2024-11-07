import { Global, Module } from '@nestjs/common';
import { KafkaOb1Module } from './kafka-ob1/kafka-ob1.module';
import { ConfigModule } from '@nestjs/config';
import { OrderFormService } from './services/orderform.service';
import { ServicesModule } from './services/services.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // This will make .env configurations accessible throughout the app
    }),
    KafkaOb1Module,
    ServicesModule
  ],
  controllers: [

  ],
  providers: [

  ],
  exports:[]
})
export class AppModule { }

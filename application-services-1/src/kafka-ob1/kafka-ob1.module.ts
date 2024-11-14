import { Module, Logger, forwardRef } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaOb1Controller } from './kafka-ob1.controller';

import { KafkaOb1ProcessingService } from './services/kafka-ob1-processing/kafka-ob1-processing.service';
import { KafkaOb1Service } from './kafka-ob1.service';
import { ServicesModule } from 'src/services/services.module';

@Module({
  imports: [
    ConfigModule,
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_OB1_CLIENT',
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: `${configService.get<string>('SERVICE_ID')}-client`,
              brokers: ['kafka-server-1.manuplex-uswest-2.local:9092'],
            },
            consumer: {
              groupId: `${configService.get<string>('SERVICE_NAME')}-group`,
              sessionTimeout: 120000,
              heartbeatInterval:5000, // Changed from 1s to 5s
              rebalanceTimeout:120000,
              allowAutoTopicCreation: false,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
    forwardRef(() => ServicesModule),
  ],
  providers: [KafkaOb1ProcessingService, KafkaOb1Service],
  controllers: [KafkaOb1Controller],
  exports: [KafkaOb1Service],
})
export class KafkaOb1Module {}

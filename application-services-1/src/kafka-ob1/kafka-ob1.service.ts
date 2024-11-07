import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { filter, timeout, take } from 'rxjs/operators';
import { lastValueFrom } from 'rxjs';

import {
  OB1MessageHeader,
  OB1MessageValue,
  CURRENT_SCHEMA_VERSION,
} from 'src/interfaces/ob1-message.interfaces';

@Injectable()
export class KafkaOb1Service implements OnModuleInit {
  constructor(
    @Inject('KAFKA_OB1_CLIENT') private readonly kafkaClient: ClientKafka,
  ) { }

  async onModuleInit() {
    // Subscribe to topics that your service will consume
    this.kafkaClient.subscribeToResponseOf('manuos-ob1-agentService');
    await this.kafkaClient.connect();
  }

  // Request-response message using built-in correlationID
  
  async sendRequest(
    messageKey: string,
    instanceName: string,
    destinationService: string,
    sourceFunction: string,
    sourceType: string,
    messageInput: any,
    userRole: string,
    userEmail: string,
  ) {
    const messageHeader: any = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sourceService: `manuos-BKRouter-1`,
      sourceFunction: sourceFunction,
      instanceName: instanceName,
      destinationService: destinationService,
      sourceType: sourceType,
      userRole: userRole,
      userEmail: userEmail,
      requestId: `RQ-${sourceFunction}-${Date.now()}`,
    };

    // Send the message and apply filters to the observable stream
    const response$ = this.kafkaClient.send('manuos-ob1-agentService', {
      key: messageKey,
      value: messageInput,
      headers: messageHeader,
    }).pipe(
      filter((response) => response !== null && response !== undefined), // Filter out null/undefined responses
      take(1), // Take the first valid response
      timeout(5000), // Optional: Set a timeout to prevent waiting indefinitely
    );

    try {
      const validResponse = await lastValueFrom(response$);
      console.log('Received valid response:', validResponse);
      return validResponse;
    } catch (error) {
      console.error('Error or timeout waiting for a valid response:', error);
      return null; // Handle as needed, e.g., return null or throw an error
    }
  }
}

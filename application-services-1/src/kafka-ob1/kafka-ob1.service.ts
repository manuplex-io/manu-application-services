import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { filter, timeout, take } from 'rxjs/operators';
import { lastValueFrom } from 'rxjs';

import {
  OB1MessageHeader,
  OB1MessageValue,
  CURRENT_SCHEMA_VERSION,
  OB1MessageHeaderClass,
} from 'src/interfaces/ob1-message.interfaces';
import { CRUDRequest } from './interfaces/CRUD.interfaces';

@Injectable()
export class KafkaOb1Service implements OnModuleInit {
  constructor(
    @Inject('KAFKA_OB1_CLIENT') private readonly kafkaClient: ClientKafka,
  ) {}

  async onModuleInit() {
    // Subscribe to topics that your service will consume
    this.kafkaClient.subscribeToResponseOf('manuos-ob1-agentService');
    this.kafkaClient.subscribeToResponseOf('manuos-ob1-databaseService');
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
      sourceService: `manuos-application-services`,
      sourceFunction: sourceFunction,
      instanceName: instanceName,
      destinationService: destinationService,
      sourceType: sourceType,
      userRole: userRole,
      userEmail: userEmail,
      requestId: `RQ-${sourceFunction}-${Date.now()}`,
    };

    // Send the message and apply filters to the observable stream
    const response$ = this.kafkaClient
      .send('manuos-ob1-agentService', {
        key: messageKey,
        value: messageInput,
        headers: messageHeader,
      })
      .pipe(
        filter((response) => response !== null && response !== undefined), // Filter out null/undefined responses
        take(1), // Take the first valid response
        timeout(20000), // Optional: Set a timeout to prevent waiting indefinitely
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

  async sendRequestSystem(
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
      sourceService: `manuos-application-services`,
      sourceFunction: sourceFunction,
      instanceName: instanceName,
      destinationService: destinationService,
      sourceType: sourceType,
      userRole: userRole,
      userEmail: userEmail,
      requestId: `RQ-${sourceFunction}-${Date.now()}`,
    };

    // Send the message and apply filters to the observable stream
    const response$ = this.kafkaClient
      .send('manuos-ob1-databaseService', {
        key: messageKey,
        value: messageInput,
        headers: messageHeader,
      })
      .pipe(
        filter((response) => response !== null && response !== undefined), // Filter out null/undefined responses
        take(1), // Take the first valid response
        timeout(20000), // Optional: Set a timeout to prevent waiting indefinitely
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

  async sendAgentCRUDRequest(request: CRUDRequest) {
    const messageHeader: OB1MessageHeaderClass = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sourceService: `manuOS-BKRouter-1`,
      sourceFunction: request.sourceFunction,
      userOrgId: request.userOrgId,
      destinationService: 'agent-services',
      sourceType: 'user',
      personRole: request.personRole,
      personId: request.personId,
      requestId: `RQ-${request.sourceFunction}-${Date.now()}`,
    };

    // Validate the message header
    if (!this.validateMessageHeader(messageHeader)) {
      throw new Error(
        'Invalid messageHeader: One or more fields are missing or invalid.',
      );
    }

    // const newFunctionInput = request.CRUDFunctionInput;
    // newFunctionInput.requestId = messageHeader.requestId;

    const messageContent = {
      functionName: request.CRUDFunctionNameInput,
      functionInput: request.CRUDFunctionInput,
    };

    const messageInput: OB1MessageValue = {
      messageContent,
      messageType: 'REQUEST',
    };

    // Send the message and apply filters to the observable stream
    const response$ = this.kafkaClient
      .send('manuos-ob1-agentService', {
        key: request.messageKey,
        value: messageInput,
        headers: messageHeader,
      })
      .pipe(
        filter((response) => response !== null && response !== undefined), // Filter out null/undefined responses
        take(1), // Take the first valid response
        timeout(30000), // Optional: Set a timeout to prevent waiting indefinitely
      );

    try {
      const validResponse = await lastValueFrom(response$);
      console.log('Received valid response from agentService:', validResponse);
      return validResponse;
    } catch (error) {
      console.error(
        'Error or timeout waiting for a valid response from agentService:',
        error,
      );
      return null; // Handle as needed, e.g., return null or throw an error
    }
  }

  private validateMessageHeader(messageHeader: OB1MessageHeaderClass): boolean {
    const disallowedValues = [null, undefined, ''];

    // Check for null or invalid values in required fields
    for (const [key, value] of Object.entries(messageHeader)) {
      if (disallowedValues.includes(value)) {
        console.error(
          `Validation failed for messageHeader: ${key} has an invalid value (${value}).`,
        );
        return false; // Return false or throw an error if needed
      }
    }

    // Add additional checks for specific fields if required
    if (!/^[A-Za-z0-9-_]+$/.test(messageHeader.sourceService)) {
      console.error(
        `Validation failed for messageHeader: sourceService contains invalid characters.`,
      );
      return false;
    }

    // Validation passed
    return true;
  }
}

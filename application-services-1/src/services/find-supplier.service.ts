import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { filter, timeout, take } from 'rxjs/operators';
import { lastValueFrom } from 'rxjs';
import { KafkaContext } from '@nestjs/microservices';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';

import {
  OB1MessageHeader,
  OB1MessageValue,
  CURRENT_SCHEMA_VERSION,
} from 'src/interfaces/ob1-message.interfaces';

@Injectable()
export class FindSupplierService implements OnModuleInit {
  constructor(private readonly kafkaService: KafkaOb1Service) {}

  async onModuleInit() {}

  async findSupplier(functionInput, context: KafkaContext): Promise<void> {
    const headers: OB1MessageHeader = context.getMessage()
      .headers as unknown as OB1MessageHeader;
    const messageKey = context.getMessage().key.toString();
    const instanceName = context.getMessage().headers.instanceName.toString();
    const destinationService = 'agent-services';
    const sourceFunction = 'findSupplier';
    const sourceType = 'service';
    const orderForm = functionInput.orderForm;
    const partDescription = orderForm.orderSummary;
    const systemPrompt =
      'You are a manufacturing consultant. Your job is to help the procurement manager in finding the right suppliers for their manufacuring needs.';

    const userPrompt = 'What Aluminum grades are commonly used for casting?';

    const messageInput = {
      messageContent: {
        functionName: 'LLMgenerateResponse',
        functionInput: {
          systemPrompt: systemPrompt,
          userPrompt: userPrompt,
          config: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            temperature: 0.7,
            maxTokens: 4096,
            topP: 1,
            frequencyPenalty: 0,
            presencePenalty: 0,
          },
        },
      },
    };
    const messageInputAdd = {
      messageType: 'REQUEST',
      ...messageInput,
    };
    const userRole = context.getMessage().headers.userRole.toString();
    const userEmail = context.getMessage().headers.userEmail.toString();

    const response = await this.kafkaService.sendRequest(
      messageKey,
      instanceName,
      destinationService,
      sourceFunction,
      sourceType,
      messageInputAdd,
      userRole,
      userEmail,
    );
  }
}

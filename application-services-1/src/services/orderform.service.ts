import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka, KafkaContext } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { filter, timeout, take } from 'rxjs/operators';
import { lastValueFrom } from 'rxjs';

import {
  OB1MessageHeader,
  OB1MessageValue,
  CURRENT_SCHEMA_VERSION,
} from 'src/interfaces/ob1-message.interfaces';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';

@Injectable()
export class OrderFormService implements OnModuleInit {
  constructor(
    private readonly kafkaOb1Service:KafkaOb1Service
  ) {}

  async onModuleInit() {
    
  }

  async getOrderForm(userInput: string, context: KafkaContext) {
    const messageHeaders = context.getMessage().headers as unknown as OB1MessageHeader
    const messageKey = context.getMessage().key?.toString();
    const messageInput = {
      messageContent: {
        functionInput: {
            systemPrompt: `
            A procurement manager has provided you with a requirement for placing an order. Extract and provide information based on below guidelines:
    
                Guidelines for extraction:
                - order_summary: A well articulated summary of the procurement manager's requirement in a maximum of 50 words
                - material_type: Extract ONLY if specific material type is mentioned 
                - manufacturing_process: Extract ONLY if specific manufacturing methods are mentioned
                - secondary_operations: Extract ONLY if specific secondary operations are explicitly stated
                - finishing: Extract ONLY if specific finishing processes are mentioned
                - product_certifications: Extract ONLY if specific product certifications are listed
                - certifications: Extract ONLY if specific company/quality certifications are mentioned
                - facilities_infrastructure: Extract ONLY if specific facility requirements are stated
                - inspection_techniques: Extract ONLY if specific inspection methods are mentioned
                - region: Extract ONLY if location is explicitly specified
            `,
          userPrompt: userInput,
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
        functionName: 'LLMgenerateResponse',
      },
    };

    const messageInputAdd = {
      messageType: 'REQUEST',
      ...messageInput,
    };

    const response = await this.kafkaOb1Service.sendRequest(
        messageKey,
        messageHeaders.instanceName,
        "agent-services",
        "getOrderForm",
        "service",
        messageInputAdd,
        messageHeaders.userRole,
        messageKey,
      );
      return response;

  }

}

import { OnModuleInit, Logger } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { OB1MessageHeader } from 'src/interfaces/ob1-message.interfaces';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import { prompts, schemas } from './prompts';
import { Suggestion } from 'src/interfaces/suggestion.interface';

export class SuggestionService implements OnModuleInit {
  constructor(private kafkaOb1Service: KafkaOb1Service) {}
  onModuleInit() {}

  async getSuggestions(suggestionPayload: Suggestion, context: KafkaContext) {
    const messageHeaders = context.getMessage().headers as unknown as OB1MessageHeader;
    const messageKey = context.getMessage().key?.toString();
    const systemPrompt = prompts[suggestionPayload.suggestion];
    const responseFormat = schemas[suggestionPayload.suggestion];

    const messageInput = {
      messageContent: {
        functionInput: {
          systemPrompt: systemPrompt,
          userPrompt: suggestionPayload.orderForm,
          responseFormat: responseFormat,
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
      'agent-services',
      'getSuggestions',
      'service',
      messageInputAdd,
      messageHeaders.userRole,
      messageKey,
    );
    return response;
  }
}

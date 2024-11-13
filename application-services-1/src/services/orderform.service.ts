import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka, KafkaContext } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { filter, timeout, take } from 'rxjs/operators';
import { lastValueFrom } from 'rxjs';
import { prompts, schemas } from './prompts';

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
    const systemPrompt = prompts.orderFormPrompt;
    const responseFormat = schemas.order_form_schema;
    const response = await this.callLLM(
      systemPrompt,
      userInput,
      responseFormat,
      messageHeaders.userRole,
      messageHeaders.userEmail,
      messageKey,
      messageHeaders.instanceName,
    );

    const userPrompt1 = JSON.stringify(response.messageContent.content)
    const materialTypeSuggestedForm = await this.materialSuggestions(
      prompts.material_type,
      userPrompt1,
      responseFormat,
      context
    )

    const materialTypeResp = JSON.stringify(materialTypeSuggestedForm.messageContent.content)

    const manufacturingSuggestedForm = await this.manufacturingSuggestions(
      prompts.manufacturing_process,
      materialTypeResp,
      responseFormat,
      context
    )

    return manufacturingSuggestedForm

  }

  async materialSuggestions(systemPrompt:string,userPrompt:string,responseFormat:any,context: KafkaContext){

    const messageHeaders = context.getMessage().headers as unknown as OB1MessageHeader
    const messageKey = context.getMessage().key?.toString();

    const response = await this.callLLM(
      systemPrompt,
      userPrompt,
      responseFormat,
      messageHeaders.userRole,
      messageHeaders.userEmail,
      messageKey,
      messageHeaders.instanceName,
    );

    return response

  }


  async manufacturingSuggestions(systemPrompt:string,userPrompt:string,responseFormat:any,context: KafkaContext){

    const messageHeaders = context.getMessage().headers as unknown as OB1MessageHeader
    const messageKey = context.getMessage().key?.toString();

    const response = await this.callLLM(
      systemPrompt,
      userPrompt,
      responseFormat,
      messageHeaders.userRole,
      messageHeaders.userEmail,
      messageKey,
      messageHeaders.instanceName,
    );

    return response

  }




  async callLLM(
    systemPrompt:string,
    userPrompt: string,
    responseFormat,
    userRole: string,
    userEmail: string,
    messageKey: string,
    instanceName: string,
  ) {
    const destinationService = 'agent-services';
    const sourceFunction = 'getOrderForm';
    const sourceType = 'service';
    const messageInput = {
      messageContent: {
        functionName: 'LLMgenerateResponse',
        functionInput: {
          systemPrompt:systemPrompt,
          userPrompt: userPrompt,
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
      },
    };

    const messageInputAdd = {
      messageType: 'REQUEST',
      ...messageInput,
    };

    const response = await this.kafkaOb1Service.sendRequest(
      messageKey,
      instanceName,
      destinationService,
      sourceFunction,
      sourceType,
      messageInputAdd,
      userRole,
      userEmail,
    );
    return response;
  }

}

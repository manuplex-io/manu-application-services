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
    const messageHeaders = context.getMessage().headers as unknown as OB1MessageHeader;
    const messageKey = context.getMessage().key?.toString();
    const systemPrompt = prompts.orderFormPrompt;
    const responseFormat = schemas.order_form_schema;

    // Initial response based on order form prompt
    const response = await this.callLLM(
        systemPrompt,
        userInput,
        responseFormat,
        messageHeaders.userRole,
        messageHeaders.userEmail,
        messageKey,
        messageHeaders.instanceName,
    );

    // Material Type Suggestion
    const userPrompt1 = JSON.stringify(response.messageContent.content);
    const materialTypeSuggestedForm = await this.generateSuggestion(
        prompts.material_type,
        userPrompt1,
        responseFormat,
        context
    );

    // Manufacturing Process Suggestion
    const materialTypeResp = JSON.stringify(materialTypeSuggestedForm.messageContent.content);
    const manufacturingSuggestedForm = await this.generateSuggestion(
        prompts.manufacturing_process,
        materialTypeResp,
        responseFormat,
        context
    );

    // Secondary Process Suggestion
    const manufacturingResp = JSON.stringify(manufacturingSuggestedForm.messageContent.content);
    const secondarySuggestedForm = await this.generateSuggestion(
        prompts.secondary_operations,
        manufacturingResp,
        responseFormat,
        context
    );

    // Finishing Process Suggestion
    const secondaryResp = JSON.stringify(secondarySuggestedForm.messageContent.content);
    const finishingSuggestedForm = await this.generateSuggestion(
        prompts.finishing,
        secondaryResp,
        responseFormat,
        context
    );

    // Product Certification Suggestion
    const finishingResp = JSON.stringify(finishingSuggestedForm.messageContent.content);
    const productCertificationForm = await this.generateSuggestion(
        prompts.product_certifications,
        finishingResp,
        responseFormat,
        context
    );

    // Certification Suggestion
    const productCertResp = JSON.stringify(productCertificationForm.messageContent.content);
    const certificationForm = await this.generateSuggestion(
        prompts.certifications,
        productCertResp,
        responseFormat,
        context
    );

    // Facilities Suggestion
    const certificationResp = JSON.stringify(certificationForm.messageContent.content);
    const facilitiesForm = await this.generateSuggestion(
        prompts.facilities_infrastructure,
        certificationResp,
        responseFormat,
        context
    );

    // Inspection Suggestion
    const facilitiesResp = JSON.stringify(facilitiesForm.messageContent.content);
    const inspectionForm = await this.generateSuggestion(
        prompts.inspection_techniques,
        facilitiesResp,
        responseFormat,
        context
    );

    return inspectionForm;
}

async generateSuggestion(
    systemPrompt: string,
    userPrompt: string,
    responseFormat: any,
    context: KafkaContext
) {
    const messageHeaders = context.getMessage().headers as unknown as OB1MessageHeader;
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

    return response;
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
        functionName: 'LLMgenerateResponse-V1',
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

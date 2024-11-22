import { Injectable } from '@nestjs/common';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import { Suggestion } from 'src/interfaces/suggestion.interface';
import { prompts, schemas } from './prompts';
import { KafkaContext } from '@nestjs/microservices';
import { OB1MessageHeader } from 'src/interfaces/ob1-message.interfaces';
import { FindSupplierService } from './find-supplier.service';
import { postMessageToSlackChannel } from './slack-utils';
import { SlackEventHandlingService } from './slack-event-handling.service';
import { NoCapabilitiesService } from './no-capability.service';
import { error } from 'console';
@Injectable()
export class DecisionService {
  constructor(private kafkaOb1Service: KafkaOb1Service,
     private findSupplierService: FindSupplierService,
     private readonly slackEventHandlingService: SlackEventHandlingService, 
     private readonly noCapabilitiesService: NoCapabilitiesService
    ) {}

  async decideFunctionCall(functionInput: any,context:KafkaContext): Promise<any> {
    
    try {
    const messageHeaders = context.getMessage().headers as unknown as OB1MessageHeader;
    const messageKey = context.getMessage().key?.toString();
    const userQuery = functionInput.userInput
    const token = process.env.slack_token
    const messageInput = {
      messageContent: {
        functionInput: {
          systemPrompt: prompts.decisionPrompt,
          userPrompt: userQuery,
          responseFormat: schemas.decisionSchema,
          config: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            temperature: 0.7,
            maxTokens: 150,
            topP: 1,
            frequencyPenalty: 0,
            presencePenalty: 0,
          },
        },
        functionName: 'LLMgenerateResponse-V1',
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
        messageKey
    );

    // Parse and return the LLM's function decision
    const content =  JSON.parse(response.messageContent.content);
    const functionName = content.function
    let message:any
    console.log("functionName",functionName)
    if (functionName === 'findSupplier') {
        postMessageToSlackChannel(functionInput.fromChannel,{text:"sure on it"},token,functionInput.thread)
        const response =  await this.findSupplierService.findSupplier(
          {...functionInput,projectName:"test1"},
          context,
        );
        const message = "Here is a  <" + response.messageContent.url + "|Google Sheet>"+ " where I have prepared the results for you"
        await postMessageToSlackChannel(functionInput.fromChannel,{text:message},token,functionInput.thread)
      }
    else if(functionName=="getJoke"){
        const response  = await this.slackEventHandlingService.slackreply(functionInput,context)
    }
    else{
        const response  = await this.noCapabilitiesService.noCapability(functionInput,context)
    }
  }
        
 catch (error) {
    }
    console.log("error",error)
  }
}
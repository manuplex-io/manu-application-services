import { Injectable, Logger } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { getChannelMessageHistory } from './slack-utils';
import { OB1MessageHeader } from 'src/interfaces/ob1-message.interfaces';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import { CRUDOperationName, CRUDRequest } from 'src/kafka-ob1/interfaces/CRUD.interfaces';
import { CRUDPromptRoute } from 'src/kafka-ob1/interfaces/promptCRUD.interfaces';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  constructor(private kafkaService: KafkaOb1Service) {}

  async chatWithUser(functionInput: any, context: KafkaContext) {
    const messageKey = context.getMessage().key.toString();
    const instanceName = context.getMessage().headers.instanceName.toString();
    const headers: OB1MessageHeader = context.getMessage()
        .headers as unknown as OB1MessageHeader;
    try {
      const { token, userId, channelId, projectName } = functionInput;

      const channelMessages = await getChannelMessageHistory(channelId, token);

      const latestMessage = channelMessages.find((message) => message.user === userId);

      if (!latestMessage) {
        throw Error("No latest message found for the user")
      }

      
      const executeDto = {
        userPromptVariables:{
          userInput:latestMessage.text
        },
        llmConfig:{
          provider: 'openai',
            model: 'gpt-4o-mini',
            temperature: 0.7,
        }
      }

      const CRUDFunctionInput = {
        CRUDOperationName: CRUDOperationName.POST,
        CRUDRoute: CRUDPromptRoute.EXECUTE_WITHOUT_USER_PROMPT,
        CRUDBody: executeDto,
        routeParams: { promptId:"6def9705-2456-4c9c-80d9-f5a19e25f657" },
      }; //CRUDFunctionInput
  
      const request: CRUDRequest = {
        messageKey: messageKey, //messageKey
        userOrgId: instanceName || 'default', //instanceName
        sourceFunction: 'executePromptWithUserPrompt', //sourceFunction
        CRUDFunctionNameInput: 'promptCRUD-V1', //CRUDFunctionNameInput
        CRUDFunctionInput, //CRUDFunctionInput
        personRole: headers.userRole.toString() || 'user', // userRole
        personId:  headers.userEmail.toString(), // userEmail
      };
      const response = await this.kafkaService.sendAgentCRUDRequest(request);
      console.log("response from llm",response.messageContent)
      const content = JSON.parse(response.messageContent)
      const plexMessage = content.Response
      const threadId = latestMessage.ts
      const messages = [{user:latestMessage.text},{plex:plexMessage}]
      this.appendConversation(threadId, context,messages);

      return { ...response.messageContent };

    } catch (error) {
      this.logger.error(`error ${error}`);
      throw Error(error)
    }
  }

  async appendConversation(threadId: string, context: KafkaContext,messages:any[]) {
    try {
      const headers: OB1MessageHeader = context.getMessage()
        .headers as unknown as OB1MessageHeader;
      const messageKey = context.getMessage().key.toString();
      const instanceName = context.getMessage().headers.instanceName.toString();
      const destinationService = 'database-service';
      const sourceFunction = 'addMessage';
      const sourceType = 'service';

      const messageInput1 = {
        messageContent: {
          functionName: 'createupdateThread', //retrieveTickets
          functionInput: {
            CRUDName: 'CREATE',
            CRUDInput: {
              tableEntity: 'OB1-threadMessage',
              threadId: threadId,
              conversation:messages
            },
          },
        },
      };
      const messageInputAdd1 = {
        messageType: 'REQUEST',
        ...messageInput1,
      };

      const response = await this.kafkaService.sendRequestSystem(
        messageKey,
        instanceName,
        destinationService,
        sourceFunction,
        sourceType,
        messageInputAdd1,
        headers.userRole.toString(),
        headers.userEmail.toString(),
      );
    } catch (error) {
        throw Error(`error in append Conversation function ${error}`)
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { getChannelMessageHistory, getThreadMessageHistory } from './slack-utils';
import { OB1MessageHeader } from 'src/interfaces/ob1-message.interfaces';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import {
  CRUDOperationName,
  CRUDRequest,
} from 'src/kafka-ob1/interfaces/CRUD.interfaces';
import { CRUDPromptRoute } from 'src/kafka-ob1/interfaces/promptCRUD.interfaces';
import axios from 'axios';
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly SLACK_BASE_URL = 'https://slack.com/api';
  constructor(private kafkaService: KafkaOb1Service) {}

  async chatWithUser(functionInput: any, context: KafkaContext) {
    const messageKey = context.getMessage().key.toString();
    const instanceName = context.getMessage().headers.instanceName.toString();
    const headers: OB1MessageHeader = context.getMessage()
      .headers as unknown as OB1MessageHeader;
  
    try {
      const { token, userId, channelId, projectName, threadId,userInput } = functionInput;
      let messages: { user?: string; system?: string }[] = [];
      let userInput1 = userInput
      let threadId1 = threadId
      if (threadId1) {
        // Fetch conversation history for the given threadId
        const threadMessages = await getThreadMessageHistory(
          channelId,
          threadId,
          token,
        );
  
        // Transform the messages into the required JSON format
        messages = threadMessages.map((message) =>
          message.user === userId
            ? { user: message.text }
            : { system: message.text },
        );
        
      } else {
        // No threadId: Fetch channel messages to find the latest user message
        const channelMessages = await getChannelMessageHistory(
          channelId,
          token,
        );
  
        const latestMessage = channelMessages.find(
          (message) => message.user === userId,
        );
        threadId1 = latestMessage.ts
  
        if (!latestMessage) {
          throw Error('No latest message found for the user');
        }
  
        // Use this message as the starting point
        userInput1 = latestMessage.text;
      }
  
      // Define the executeDto with the conversation history
      const executeDto = {
        userPromptVariables: {
          userInput1,
        },
        messageHistory: messages, // Pass the transformed history
        llmConfig: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          temperature: 0.7,
        },
      };
  
      const CRUDFunctionInput = {
        CRUDOperationName: CRUDOperationName.POST,
        CRUDRoute: CRUDPromptRoute.EXECUTE_WITHOUT_USER_PROMPT,
        CRUDBody: executeDto,
        routeParams: { promptId: '6def9705-2456-4c9c-80d9-f5a19e25f657' },
      }; //CRUDFunctionInput
  
      const request: CRUDRequest = {
        messageKey, //messageKey
        userOrgId: instanceName || 'default', //instanceName
        sourceFunction: 'executePromptWithUserPrompt', //sourceFunction
        CRUDFunctionNameInput: 'promptCRUD-V1', //CRUDFunctionNameInput
        CRUDFunctionInput, //CRUDFunctionInput
        personRole: headers.userRole.toString() || 'user', // userRole
        personId: headers.userEmail.toString(), // userEmail
      };
  
      const response = await this.kafkaService.sendAgentCRUDRequest(request);
      console.log('response from llm', response.messageContent);
  
      const parsedMessage = JSON.parse(response.messageContent.content);
      const plexMessage = parsedMessage.Response;
  
      // Append the bot's response to the history
      if(!threadId){
        messages.push({ user: userInput1 })
      }
      messages.push({ system: plexMessage });
  
      // Save the updated conversation history
      await this.appendConversation(threadId1, context, messages);
  
      // Post the bot's response to the thread
      await this.postMessageToChannel(
        channelId,
        { text: plexMessage },
        token,
        threadId, // Post the message in the thread
      );
  
      return { ...response.messageContent };
    } catch (error) {
      this.logger.error(`error ${error}`);
      throw Error(error);
    }
  }
  

  async appendConversation(
    threadId: string,
    context: KafkaContext,
    messages: any[],
  ) {
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
              conversation: messages,
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
      throw Error(`error in append Conversation function ${error}`);
    }
  }
  private async postMessageToChannel(
    channel: string,
    message: { text?: string; blocks?: any[] },
    token: string,
    thread_ts?: string,
  ): Promise<void> {
    try {
      const response = await axios.post(
        `${this.SLACK_BASE_URL}/chat.postMessage`,
        {
          channel: channel,
          text: message.text, // Fallback text for notifications or unsupported clients
          blocks: message.blocks, // Richly formatted blocks
          thread_ts: thread_ts,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.data.ok) {
        throw new Error(`Failed to post message: ${response.data.error}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to post message to channel ${channel}:`,
        error.response?.data,
      );
      throw error;
    }
  }
}

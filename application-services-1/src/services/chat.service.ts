import { Injectable, Logger } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { getChannelMessageHistory } from './slack-utils';
import { OB1MessageHeader } from 'src/interfaces/ob1-message.interfaces';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  constructor(private kafkaService: KafkaOb1Service) {}

  async chatWithUser(functionInput: any, context: KafkaContext) {
    try {
      const { token, userId, channelId, thread_ts } = functionInput;

      const messages = await getChannelMessageHistory(channelId, token);

      const latestMessage = messages.find((message) => message.user === userId);

      if (latestMessage) {
        this.appendConversation(functionInput, context);
      }
    } catch (error) {
      this.logger.error(`error ${error}`);
      throw Error(error)
    }
  }

  async appendConversation(functionInput: any, context: KafkaContext) {
    try {
      const headers: OB1MessageHeader = context.getMessage()
        .headers as unknown as OB1MessageHeader;
      const messageKey = context.getMessage().key.toString();
      const instanceName = context.getMessage().headers.instanceName.toString();
      const destinationService = 'database-service';
      const sourceFunction = 'addMessage';
      const sourceType = 'service';
      const threadId = functionInput.thread_ts;

      const messageInput1 = {
        messageContent: {
          functionName: 'createupdateThread', //retrieveTickets
          functionInput: {
            CRUDName: 'CREATE',
            CRUDInput: {
              tableEntity: 'OB1-threadMessage',
              threadId: threadId,
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

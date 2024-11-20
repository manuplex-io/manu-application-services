// src/kafka-ob1/services/kafka-ob1-processing/kafka-ob1-processing.service.ts
import {
  Injectable,
  Logger,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  OB1MessageValue,
  OB1MessageHeader,
} from 'src/interfaces/ob1-message.interfaces';
import { KafkaContext } from '@nestjs/microservices';
import { OrderFormService } from 'src/services/orderform.service';
import { FindSupplierService } from 'src/services/find-supplier.service';
import { SuggestionService } from 'src/services/suggestion.service';
import { ShortlistSupplierService } from 'src/services/shortlist-supplier.service';
import { SlackChannelService } from 'src/services/slack-channel-service';

@Injectable()
export class KafkaOb1ProcessingService {
  private readonly logger = new Logger(KafkaOb1ProcessingService.name);
  private validationPipe = new ValidationPipe({
    transform: true,
    whitelist: true,
  }); // Instantiates ValidationPipe
  constructor(
    private readonly orderFormService: OrderFormService,
    private readonly findSupplierService: FindSupplierService,
    private readonly suggestionService: SuggestionService,
    private readonly shortlistSupplierService: ShortlistSupplierService,
    private readonly slackChannelService: SlackChannelService
  ) {}

  async processRequest(message: OB1MessageValue, context: KafkaContext) {
    const messageHeaders = context.getMessage().headers;
    const userEmail = messageHeaders['userEmail'] as string;

    try {
      const functionName = message.messageContent.functionName;
      let functionInput = message.messageContent.functionInput;

      // Validate functionInput as LLMRequest
      // try {
      //     functionInput = await this.validationPipe.transform(functionInput, { metatype: LLMRequest, type: 'body' });
      // } catch (validationError) {
      //     this.logger.error(`Validation failed for functionInput: ${validationError.message}`, validationError.stack);
      //     throw new BadRequestException('Invalid functionInput format');
      // }

      // Check if the function exists and call it
      // Check if the function is CRUDUserfunction and handle accordingly
      if (functionName === 'getOrderForm') {
        return await this.orderFormService.getOrderForm(functionInput, context);
      } else if (functionName === 'findSupplier') {
        return await this.findSupplierService.findSupplier(
          functionInput,
          context,
        );
      } else if (functionName === 'getSuggestions') {
        return await this.suggestionService.getSuggestions(
          functionInput,
          context,
        );
      } else if (functionName === 'shortlistSupplier') {
        return await this.shortlistSupplierService.shortListSupplier(
          functionInput,
          context,
        );
      } else if (functionName === 'createChannel') {
        return await this.slackChannelService.createAndJoinChannel(
          functionInput,
          context,
        );
      }
       else if (functionName === 'CRUDInstancesfunction') {
        return { errorMessage: 'CRUDInstancesfunction not implemented' };
      } else {
        this.logger.error(`Function ${functionName} not found`);
        return { errorMessage: `Function ${functionName} not found` };
      }
    } catch (error) {
      this.logger.error(
        `Error processing message for user with email ${userEmail}: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to process request');
    }
  }
}

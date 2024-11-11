import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { filter, timeout, take } from 'rxjs/operators';
import { lastValueFrom } from 'rxjs';
import { KafkaContext } from '@nestjs/microservices';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import { TavilySearchService } from './tavily-search.service';
import { schemas } from './prompts';

import {
  OB1MessageHeader,
  OB1MessageValue,
  CURRENT_SCHEMA_VERSION,
} from 'src/interfaces/ob1-message.interfaces';

@Injectable()
export class FindSupplierService implements OnModuleInit {
  constructor(
    private readonly kafkaService: KafkaOb1Service,
    private readonly tavilySearchService: TavilySearchService,
  ) {}

  async onModuleInit() {}

  async getSupplierInfo(functionInput: any) {
    const orderForm = functionInput.orderForm;
    const partDescription = orderForm.orderSummary;
    const query = `Find me 10 Indian suppliers for ${partDescription}`;
    const supplierRawData = await this.tavilySearchService.tavilySearch(
      query,
      {},
    );
    console.log(supplierRawData.results);
    return supplierRawData;
  }

  async getSupplierRevenue(supplierName: string, context: KafkaContext) {
    const query = `Find me the annual revenue of ${supplierName}. The revenue should be in USD. Convert it into USD if it is in any other currency.`;
    console.log('Query', query);
    const supplierRevenue = await this.tavilySearchService.tavilySearch(
      query,
      {},
    );
    const supplierRevenueList = JSON.stringify(supplierRevenue.results);

    const userPrompt = `Given the following list of search results from the web, identify and give revenue of the supplier. Here is the list:${supplierRevenueList}`;

    const response = await this.callLLM(
      userPrompt,
      schemas['get_supplier_revenue'],
      context.getMessage().headers.userRole.toString(),
      context.getMessage().headers.userEmail.toString(),
      context.getMessage().key.toString(),
      context.getMessage().headers.instanceName.toString(),
    );

    const result = JSON.parse(response.messageContent.content);

    return result.revenue;
  }

  async getSupplierCertification(supplierName: string, context: KafkaContext) {
    const query = `Find and give the quality certifications of ${supplierName} from their website and other sources.`;
    console.log('Query', query);
    const supplierCertification = await this.tavilySearchService.tavilySearch(
      query,
      {},
    );
    const supplierCertificationList = JSON.stringify(
      supplierCertification.results,
    );

    const userPrompt = `Given the following list of search results from the web, identify and give certifications of the supplier. Here is the list:${supplierCertificationList}`;

    const response = await this.callLLM(
      userPrompt,
      schemas['get_supplier_certifications'],
      context.getMessage().headers.userRole.toString(),
      context.getMessage().headers.userEmail.toString(),
      context.getMessage().key.toString(),
      context.getMessage().headers.instanceName.toString(),
    );

    const result = JSON.parse(response.messageContent.content);

    return result.certifications;
  }

  async addRevenueToCompanies(companies: any, context: KafkaContext) {
    const companiesWithRevenue = await Promise.all(
      companies.map(async (company: any) => {
        const revenue = await this.getSupplierRevenue(company.name, context);
        return {
          ...company,
          revenue: revenue,
        };
      }),
    );
    return companiesWithRevenue;
  }

  async addCertificationToCompanies(companies: any, context: KafkaContext) {
    const companiesWithCertification = await Promise.all(
      companies.map(async (company: any) => {
        const certifications = await this.getSupplierCertification(
          company.name,
          context,
        );
        return {
          ...company,
          certifications: certifications,
        };
      }),
    );
    return companiesWithCertification;
  }

  async callLLM(
    userPrompt,
    responseFormat,
    userRole,
    userEmail,
    messageKey,
    instanceName,
  ) {
    const destinationService = 'agent-services';
    const sourceFunction = 'findSupplier';
    const sourceType = 'service';
    const messageInput = {
      messageContent: {
        functionName: 'LLMgenerateResponse',
        functionInput: {
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
    return response;
  }

  async findSupplier(functionInput: any, context: KafkaContext) {
    const headers: OB1MessageHeader = context.getMessage()
      .headers as unknown as OB1MessageHeader;
    const messageKey = context.getMessage().key.toString();
    const instanceName = context.getMessage().headers.instanceName.toString();
    const supplierRawData = await this.getSupplierInfo(functionInput);
    const supplierList = JSON.stringify(supplierRawData.results);
    console.log(typeof supplierList);
    // const systemPrompt =
    //   'You are a manufacturing consultant. Your job is to help the procurement manager in finding the right suppliers for their manufacuring needs.';

    const userPrompt = `Given the following list of search results from the web, identify and give valid supplier names. Here is the list:${supplierList}`;
    const responseFormat = schemas['get_supplier_names'];
    const response = await this.callLLM(
      userPrompt,
      responseFormat,
      headers.userRole.toString(),
      headers.userEmail.toString(),
      messageKey,
      instanceName,
    );

    const supplierNames = JSON.parse(response.messageContent.content);

    const responseWithRevenue = await this.addRevenueToCompanies(
      supplierNames.names,
      context,
    );

    console.log('Response with revenue', responseWithRevenue);
    const responseWithCertification = await this.addCertificationToCompanies(
      responseWithRevenue,
      context,
    );
    console.log('Response with certification', responseWithCertification);

    const supplierWithRevenueCertification = {
      messageContent: { content: JSON.stringify(responseWithCertification) },
    };
    return supplierWithRevenueCertification;
  }
}

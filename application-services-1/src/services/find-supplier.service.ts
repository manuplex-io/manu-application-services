import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import { TavilySearchService } from './tavily-search.service';
import { GoogleSheetService } from './google-sheet.service';
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
    private readonly googleSheetService: GoogleSheetService,
  ) {}

  async onModuleInit() {}

  async getSupplierInfo(functionInput: any, context: KafkaContext) {
    const userInput = functionInput.userInput;
    const userPrompt = `Given the following user input, identify and give the name of the part that the user is looking for. Examples of part names could be sheet metal stampings, crankshafts, plastic injection molded cups, etc. Here is the user input:${userInput}`;

    const response = await this.callLLM(
      userPrompt,
      schemas['get_part_description'],
      context.getMessage().headers.userRole.toString(),
      context.getMessage().headers.userEmail.toString(),
      context.getMessage().key.toString(),
      context.getMessage().headers.instanceName.toString(),
    );

    const result = JSON.parse(response.messageContent.content);
    const partDescription = result.part_description;
    const query = `Find me Indian suppliers for ${partDescription}`;
    const supplierRawData = await this.tavilySearchService.tavilySearch(query, {
      max_results: 5,
    });
    console.log(supplierRawData.results);
    return supplierRawData;
  }

  async getSupplierRevenue(supplierName: string, context: KafkaContext) {
    const query = `What is the annual revenue of ${supplierName}`;
    console.log('Query', query);
    const supplierRevenue = await this.tavilySearchService.tavilySearch(query, {
      search_depth: 'advanced',
    });
    const supplierRevenueList = JSON.stringify(supplierRevenue.results);

    const userPrompt = `Given the following search result from the web, identify and give annual revenue of the supplier ${supplierName}. Perform two steps to give the revenue. Step1: Convert the revenue to USD. Use exchange rate 1 USD = 83 INR if required. Step 2: Give the output as a number. Here is the search result:${supplierRevenueList}`;

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
    const query = `What quality certifications does the supplier ${supplierName} have?`;
    console.log('Query', query);
    const supplierCertification = await this.tavilySearchService.tavilySearch(
      query,
      { search_depth: 'advanced' },
    );

    const supplierCertificationList = JSON.stringify(
      supplierCertification.results,
    );

    const userPrompt = `Given the following search results from the web, identify, extract, and give quality certifications of the supplier ${supplierName}. Here is the search result:${supplierCertificationList}`;

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

  async getSupplierContact(supplierName: string, context: KafkaContext) {
    const query = `What are the contact details of ${supplierName}.`;
    console.log('Query', query);
    const supplierContact = await this.tavilySearchService.tavilySearch(query, {
      search_depth: 'advanced',
    });

    const supplierContactList = JSON.stringify(supplierContact.results);

    const userPrompt = `Given the following search results from the web, identify and give contact details of the supplier ${supplierName}. Contact details should include phone, address, and email.  Here is the search result:${supplierContactList}`;

    const response = await this.callLLM(
      userPrompt,
      schemas['get_supplier_contact'],
      context.getMessage().headers.userRole.toString(),
      context.getMessage().headers.userEmail.toString(),
      context.getMessage().key.toString(),
      context.getMessage().headers.instanceName.toString(),
    );

    const result = JSON.parse(response.messageContent.content);

    return result.contact;
  }

  async getSupplierCapabilities(supplierName: string, context: KafkaContext) {
    const query = `What are the manufacturing capabilities and processes of ${supplierName}`;
    console.log('Query', query);
    const supplierCapabilities = await this.tavilySearchService.tavilySearch(
      query,
      { search_depth: 'advanced' },
    );

    const supplierCapabilitiesList = JSON.stringify(
      supplierCapabilities.results,
    );

    const userPrompt = `Given the following search results from the web, identify and give capabalities in terms of  manufacturing processes for the supplier ${supplierName}. Ensure you only give manufacturing processes. Here is the search result:${supplierCapabilitiesList}`;

    const response = await this.callLLM(
      userPrompt,
      schemas['get_supplier_manufacturing_capabilities'],
      context.getMessage().headers.userRole.toString(),
      context.getMessage().headers.userEmail.toString(),
      context.getMessage().key.toString(),
      context.getMessage().headers.instanceName.toString(),
    );

    const result = JSON.parse(response.messageContent.content);

    return result.capabilities;
  }

  async getSupplierExportCountries(
    supplierName: string,
    context: KafkaContext,
  ) {
    const query = `Which countries does ${supplierName} export to?`;
    console.log('Query', query);
    const supplierExportCountries = await this.tavilySearchService.tavilySearch(
      query,
      { search_depth: 'advanced' },
    );

    const supplierExportCountriesList = JSON.stringify(
      supplierExportCountries.results,
    );

    const userPrompt = `Given the following search results from the web, identify and give the countries that the supplier ${supplierName} exports to. Here is the search result:${supplierExportCountriesList}`;

    const response = await this.callLLM(
      userPrompt,
      schemas['get_supplier_export_countries'],
      context.getMessage().headers.userRole.toString(),
      context.getMessage().headers.userEmail.toString(),
      context.getMessage().key.toString(),
      context.getMessage().headers.instanceName.toString(),
    );

    const result = JSON.parse(response.messageContent.content);

    return result.countries;
  }

  async addExportCountriesToCompanies(companies: any, context: KafkaContext) {
    const companiesWithExportCountries = await Promise.all(
      companies.map(async (company: any) => {
        const exportCountries = await this.getSupplierExportCountries(
          company.label,
          context,
        );
        return {
          ...company,
          export_countries: exportCountries,
        };
      }),
    );
    return companiesWithExportCountries;
  }

  async addCapabilitiesToCompanies(companies: any, context: KafkaContext) {
    const companiesWithCapabilities = await Promise.all(
      companies.map(async (company: any) => {
        const capabilities = await this.getSupplierCapabilities(
          company.label,
          context,
        );
        return {
          ...company,
          capabilities: capabilities,
        };
      }),
    );
    return companiesWithCapabilities;
  }

  async addRevenueToCompanies(companies: any, context: KafkaContext) {
    const companiesWithRevenue = await Promise.all(
      companies.map(async (company: any) => {
        const revenue = await this.getSupplierRevenue(company.label, context);
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
          company.label,
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

  async addContactToCompanies(companies: any, context: KafkaContext) {
    const companiesWithContact = await Promise.all(
      companies.map(async (company: any) => {
        const contact = await this.getSupplierContact(company.label, context);
        return {
          ...company,
          contact: contact,
        };
      }),
    );
    return companiesWithContact;
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
    const supplierRawData = await this.getSupplierInfo(functionInput, context);
    const supplierList = JSON.stringify(supplierRawData.results);
    const destinationService = 'database-service';
    const sourceFunction = 'findSupplier';
    const sourceType = 'service';
    const projectName = functionInput.projectName;

    console.log(typeof supplierList);
    // const systemPrompt =
    //   'You are a manufacturing consultant. Your job is to help the procurement manager in finding the right suppliers for their manufacuring needs.';

    const userPrompt = `Given the following list of search results from the web, identify and give three valid supplier names. Ensure you only give three names. Here is the list:${supplierList}`;
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
    console.log('Supplier names', supplierNames.names);
    console.log(typeof supplierNames.names);

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
    const responseWithContact = await this.addContactToCompanies(
      responseWithCertification,
      context,
    );
    console.log('Response with contact', responseWithContact);
    const responseWithCapabilities = await this.addCapabilitiesToCompanies(
      responseWithContact,
      context,
    );
    console.log('Response with capabilities', responseWithCapabilities);
    const responseWithExportCountries =
      await this.addExportCountriesToCompanies(
        responseWithCapabilities,
        context,
      );
    console.log('Response with export countries', responseWithExportCountries);

    const supplierListV1 = {
      supplierListV1: responseWithExportCountries,
    };

    const messageInput = {
      messageContent: {
        functionName: 'CRUDUserfunction',
        functionInput: {
          CRUDName: 'POST',
          CRUDInput: {
            tableEntity: 'OB1-assets',
            assetName: 'SupplierListv1',
            projectName: projectName,
            assetData: supplierListV1,
            assetType: 'SupplierList',
          },
        },
      },
    };
    const messageInputAdd = {
      messageType: 'REQUEST',
      ...messageInput,
    };

    const response1 = this.kafkaService.sendRequestSystem(
      messageKey,
      instanceName,
      destinationService,
      sourceFunction,
      sourceType,
      messageInputAdd,
      headers.userRole.toString(),
      headers.userEmail.toString(),
    );

    const googleSheetInput = {
      Summary: {
        suppliers: responseWithExportCountries,
      },
    };

    const googleSheetURL = this.googleSheetService.createAndPopulateGoogleSheet(
      headers.userEmail.toString(),
      googleSheetInput,
    );

    console.log('Google sheet URL', googleSheetURL);

    return {
      messageContent: {
        content: responseWithExportCountries,
        url: googleSheetURL,
      },
    };
  }
}

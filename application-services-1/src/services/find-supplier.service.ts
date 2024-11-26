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
import axios from 'axios';

@Injectable()
export class FindSupplierService implements OnModuleInit {
  private readonly subdomain: string
  constructor(
    private readonly kafkaService: KafkaOb1Service,
    private readonly tavilySearchService: TavilySearchService,
    private readonly googleSheetService: GoogleSheetService,
  ) {
    this.subdomain = process.env.ENV === 'prod' ? 'os' : 'app'; // Set 'os' for prod and 'app' for dev
  }

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
      'gpt-4o-mini',
    );

    const result = JSON.parse(response.messageContent.content);
    const partDescription = result.part_description;
    const query = `Who are the best Indian manufacturers of ${partDescription}`;
    const supplierRawData = await this.tavilySearchService.tavilySearch(query, {
      max_results: 20,
    });
    console.log(supplierRawData.results);
    return supplierRawData;
  }

  async getSupplierRevenue(supplierName: string, context: KafkaContext) {
    const query = `What is the annual revenue of ${supplierName}`;
    console.log('Query', query);
    const supplierRevenue = await this.tavilySearchService.tavilySearchShort(
      query,
      {
        search_depth: 'advanced',
        max_results: 20,
      },
    );
    // const supplierRevenueList = JSON.stringify(supplierRevenue.results);

    // const userPrompt = `Given the following search result from the web, identify and give annual revenue of the supplier ${supplierName}. Perform the following steps to give the revenue. Step1: Convert the revenue into a number if it is mentioned in millions, crores, or other such measures. Step 2: Check if the number is in US dollars or in Indian currency like INR and Rs. Step 3: If it is in INR or Rs, convert the revenue to US dollars use exchange rate 1 USD = 83 INR. Step 4: Give the output in US dollars as a number. Ensure you only give the final revenue number as the output. Don't give the steps you performed in the output. Here is the search result:${supplierRevenueList}`;
    const userPrompt = `Given the following search result from the web, identify and give annual revenue of the supplier.Ensure you only give the revenuu as the output.Here is the search result:${supplierRevenue}`;
    const response = await this.callLLM(
      userPrompt,
      schemas['get_supplier_revenue'],
      context.getMessage().headers.userRole.toString(),
      context.getMessage().headers.userEmail.toString(),
      context.getMessage().key.toString(),
      context.getMessage().headers.instanceName.toString(),
      'gpt-4o',
    );

    try {
      const result = JSON.parse(response.messageContent.content);
      return result.revenue;
    } catch {
      return { revenue: 'Not found' };
    }
  }

  async getSupplierCertification(supplierName: string, context: KafkaContext) {
    const query = `What quality certifications does the supplier ${supplierName} have?`;
    console.log('Query', query);
    const supplierCertification = await this.tavilySearchService.tavilySearch(
      query,
      { search_depth: 'advanced', max_results: 20 },
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
      'gpt-4o-mini',
    );

    try {
      const result = JSON.parse(response.messageContent.content);
      return result.certifications;
    } catch {
      return { certifications: 'Not found' };
    }
  }

  async getSupplierContact(supplierName: string, context: KafkaContext) {
    const query = `What are the contact details of ${supplierName}.`;
    console.log('Query', query);
    const supplierContact = await this.tavilySearchService.tavilySearch(query, {
      search_depth: 'advanced',
      max_results: 20,
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
      'gpt-4o-mini',
    );

    try {
      const result = JSON.parse(response.messageContent.content);
      return result.contact;
    } catch {
      return { contact: 'Not found' };
    }
  }

  async getSupplierCapabilities(supplierName: string, context: KafkaContext) {
    const query = `What are the manufacturing capabilities and processes of ${supplierName}`;
    console.log('Query', query);
    const supplierCapabilities = await this.tavilySearchService.tavilySearch(
      query,
      { search_depth: 'advanced', max_results: 20 },
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
      'gpt-4o-mini',
    );

    try {
      const result = JSON.parse(response.messageContent.content);
      return result.capabilities;
    } catch {
      return { capabilities: 'Not found' };
    }
  }

  async getSupplierExportCountries(
    supplierName: string,
    context: KafkaContext,
  ) {
    const query = `Which countries does ${supplierName} export to?`;
    console.log('Query', query);
    const supplierExportCountries = await this.tavilySearchService.tavilySearch(
      query,
      { search_depth: 'advanced', max_results: 20 },
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
      'gpt-4o-mini',
    );

    try {
      const result = JSON.parse(response.messageContent.content);
      return result.countries;
    } catch {
      return { countries: 'Not found' };
    }
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
    model,
  ) {
    const destinationService = 'agent-services';
    const sourceFunction = 'findSupplier';
    const sourceType = 'service';
    const messageInput = {
      messageContent: {
        functionName: 'LLMgenerateResponse-V1',
        functionInput: {
          userPrompt: userPrompt,
          responseFormat: responseFormat,
          config: {
            provider: 'openai',
            model: model,
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

    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTAyMjMzODkyMTg2MTU2NDQ4MjUiLCJlbWFpbCI6ImFwb29ydkBtYW51cGxleC5pbyIsInBlcnNvbklkIjoiYXBvb3J2QG1hbnVwbGV4LmlvIiwicGVyc29uUm9sZSI6ImNvbnN1bHRhbnQiLCJ1c2VyT3JnSWQiOiJkZWZhdWx0IiwiaW5zdGFuY2VfaWRzIjpbImNvbnN1bHRhbnQiXSwibmFtZSI6IkFwb29ydiBNYWxob3RyYSIsImdpdmVuTmFtZSI6IkFwb29ydiIsImZhbWlseU5hbWUiOiJNYWxob3RyYSIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NMZXJhRFR1dVJzZjNJSEE4OW4yZFNSTWxWalJKQTRpcTdieG5qMlJaWHNDQjItN2c9czk2LWMiLCJwZXJzb25Ib21lRG9tYWluIjoibWFudXBsZXguaW8iLCJpYXQiOjE3MzI2MDc3NjIsImV4cCI6MTczMjYyMjE2Mn0.2KO31VtEIg3EDyb9a50vA4xt1aIdJdSD8onGWGYNYgE'
    const promptId = '5226cefb-8e9a-48da-a793-b0bb1655ad7c'; // Replace with the actual prompt ID
    const url = `https://${this.subdomain}.manuplex.io/services/admin/agent-services/prompts/${promptId}/executeWithoutUserPrompt`;
    
    
    // Axios request
  // try {
    const response = await axios.post(
      url,
      {
        userPromptVariables: {supplierList}
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          // 'User-Role': headers.userRole.toString(),
          // 'User-Email': headers.userEmail.toString(),
          // 'Message-Key': messageKey,
          // 'Instance-Name': instanceName,
        },
      },
    );

    console.log("response", response.data)
  //   // Return response data
  //   return response.data;
  // } catch (error) {
  //   console.error('Error in findSupplier:', error);
  //   throw new Error('Failed to execute the supplier finding process.');
  // }

    // const userPrompt = `Given the following list of search results from the web, identify and give 10 valid supplier names. Ensure you only give ten names. Here is the list:${supplierList}`;
    // const responseFormat = schemas['get_supplier_names'];
    // const response = await this.callLLM(
    //   userPrompt,
    //   responseFormat,
    //   headers.userRole.toString(),
    //   headers.userEmail.toString(),
    //   messageKey,
    //   instanceName,
    //   'gpt-4o-mini',
    // );

    // const supplierNames = JSON.parse(response.messageContent.content);
    const supplierNames = JSON.parse(response.data.content);
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

    const googleSheetURL =
      await this.googleSheetService.createAndPopulateGoogleSheet(
        headers.userEmail.toString(),
        googleSheetInput,
      );

    console.log('Google sheet URL', googleSheetURL);

    const messageInput1 = {
      messageContent: {
        functionName: 'CRUDUserfunction',
        functionInput: {
          CRUDName: 'POST',
          CRUDInput: {
            tableEntity: 'OB1-assets',
            assetName: 'supplierGoogleSheet',
            projectName: projectName,
            assetExternalUrl: googleSheetURL,
            assetType: 'googleSheet',
          },
        },
      },
    };
    const messageInputAdd1 = {
      messageType: 'REQUEST',
      ...messageInput1,
    };

    const response2 = this.kafkaService.sendRequestSystem(
      messageKey,
      instanceName,
      destinationService,
      sourceFunction,
      sourceType,
      messageInputAdd1,
      headers.userRole.toString(),
      headers.userEmail.toString(),
    );

    return {
      messageContent: {
        content: responseWithExportCountries,
        url: googleSheetURL,
      },
    };
  }
}

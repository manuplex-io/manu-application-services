import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka, KafkaContext } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { filter, timeout, take } from 'rxjs/operators';
import { lastValueFrom } from 'rxjs';

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
    const responseFormat = {
        "type":"json_schema",
        "json_schema":{
            "name": "OrderForm",
            "schema": {
              "type": "object",
              "properties": {
                "order_summary": {
                  "type": "string",
                  "description": "Summary message regarding the order"
                },
                "material_type": {
                  "type": "array",
                  "description": "List of material types.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "label": {
                        "type": "string",
                        "description": "The label of the material type"
                      }
                    },
                    "required": [
                      "label"
                    ],
                    "additionalProperties": false
                  }
                },
                "manufacturing_process": {
                  "type": "array",
                  "description": "List of manufacturing processes.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "label": {
                        "type": "string",
                        "description": "The label of the manufacturing process"
                      }
                    },
                    "required": [
                      "label"
                    ],
                    "additionalProperties": false
                  }
                },
                "secondary_operations": {
                  "type": "array",
                  "description": "List of secondary operations.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "label": {
                        "type": "string",
                        "description": "The label of the secondary operation"
                      }
                    },
                    "required": [
                      "label"
                    ],
                    "additionalProperties": false
                  }
                },
                "finishing": {
                  "type": "array",
                  "description": "List of finishing types.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "label": {
                        "type": "string",
                        "description": "The label of the finishing type"
                      }
                    },
                    "required": [
                      "label"
                    ],
                    "additionalProperties": false
                  }
                },
                "product_certifications": {
                  "type": "array",
                  "description": "List of product certifications.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "label": {
                        "type": "string",
                        "description": "The label of the product certification"
                      }
                    },
                    "required": [
                      "label"
                    ],
                    "additionalProperties": false
                  }
                },
                "certifications": {
                  "type": "array",
                  "description": "List of certifications.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "label": {
                        "type": "string",
                        "description": "The label of the certification"
                      }
                    },
                    "required": [
                      "label"
                    ],
                    "additionalProperties": false
                  }
                },
                "facilities_infrastructure": {
                  "type": "array",
                  "description": "List of facilities or infrastructure.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "label": {
                        "type": "string",
                        "description": "The label of the facility or infrastructure"
                      }
                    },
                    "required": [
                      "label"
                    ],
                    "additionalProperties": false
                  }
                },
                "inspection_techniques": {
                  "type": "array",
                  "description": "List of inspection techniques.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "label": {
                        "type": "string",
                        "description": "The label of the inspection technique"
                      }
                    },
                    "required": [
                      "label"
                    ],
                    "additionalProperties": false
                  }
                },
                "region": {
                  "type": "array",
                  "description": "List of regions.",
                  "items": {
                    "type": "object",
                    "properties": {
                      "label": {
                        "type": "string",
                        "description": "The label of the region"
                      }
                    },
                    "required": [
                      "label"
                    ],
                    "additionalProperties": false
                  }
                }
              },
              "required": [
                "order_summary",
                "material_type",
                "manufacturing_process",
                "secondary_operations",
                "finishing",
                "product_certifications",
                "certifications",
                "facilities_infrastructure",
                "inspection_techniques",
                "region"
              ],
              "additionalProperties": false
            },
            "strict": true
          }
    }
    const messageInput = {
      messageContent: {
        functionInput: {
            systemPrompt: `
            A procurement manager has provided you with a requirement for placing an order. Follow these guidelines to **extract relevant information** and **suggest suitable values** for all fields, even if some details are already mentioned. Your responses should follow the provided JSON schema.

            Guidelines:
            1. **EXTRACT EXPLICITLY MENTIONED INFORMATION**:
                - **order_summary**: A well articulated summary of the procurement manager's requirement in a maximum of 50 words
                - **material_type**: Extract if a specific material type is mentioned.
                - **manufacturing_process**: Extract if a specific manufacturing method is mentioned.
                - **secondary_operations**: Extract if specific secondary operations are explicitly stated.
                - **finishing**: Extract if specific finishing processes are mentioned.
                - **product_certifications**: Extract if specific product certifications are listed.
                - **certifications**: Extract if specific company/quality certifications are mentioned.
                - **facilities_infrastructure**: Extract if specific facility requirements are stated.
                - **inspection_techniques**: Extract if specific inspection methods are mentioned.
                - **region**: Extract if a location is explicitly specified.

            2. **ALWAYS SUGGEST ADDITIONAL SUITABLE VALUES**:
                - For each field defined above, **even if information is already provided**, suggest additional relevant and commercially viable values. These suggestions should be contextually appropriate to the requirements.
                
            Structure your response according to the JSON schema, providing both extracted values and additional suggestions for each field, ensuring all properties are populated as specified.
            `,
          userPrompt: userInput,
          responseFormat:responseFormat,
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
        functionName: 'LLMgenerateResponse',
      },
    };

    const messageInputAdd = {
      messageType: 'REQUEST',
      ...messageInput,
    };

    const response = await this.kafkaOb1Service.sendRequest(
        messageKey,
        messageHeaders.instanceName,
        "agent-services",
        "getOrderForm",
        "service",
        messageInputAdd,
        messageHeaders.userRole,
        messageKey,
      );
      return response;

  }

}

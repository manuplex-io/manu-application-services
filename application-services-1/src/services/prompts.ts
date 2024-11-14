const json_schema1 = {
  type: 'json_schema',
  json_schema: {
    title: 'order_summary',
    description:
      'Schema for processing the response with iterated Order Summary.',
    type: 'object',
    properties: {
      order_summary: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message regarding the order summary',
          },
        },
        required: ['message'],
      },
    },
    required: ['order_summary'],
  },
};

const json_schema2 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_material_types',
    schema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          description:
            "A list of suggested material types based on procurement manager's requirements.",
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'The label of the material type',
              },
            },
            required: ['label'],
            additionalProperties: false,
          },
        },
      },
      required: ['suggestions'],
      additionalProperties: false,
    },
    strict: true,
  },
};

const json_schema3 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_manufacturing_processes',
    schema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          description: 'A list of suggested manufacturing processes.',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'The label of the manufacturing process.',
              },
            },
            required: ['label'],
            additionalProperties: false,
          },
        },
      },
      required: ['suggestions'],
      additionalProperties: false,
    },
    strict: true,
  },
};

const json_schema4 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_secondary_operations',
    schema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'The label of the secondary operations',
              },
            },
            required: ['label'],
            additionalProperties: false,
          },
        },
      },
      required: ['suggestions'],
      additionalProperties: false,
    },
    strict: true,
  },
};

const json_schema5 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_finishing_process',
    schema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          description: 'A list of suggested finishing processes.',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'The label of the finishing process.',
              },
            },
            required: ['label'],
            additionalProperties: false,
          },
        },
      },
      required: ['suggestions'],
      additionalProperties: false,
    },
    strict: true,
  },
};

const json_schema6 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_product_certifications',
    schema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          description: 'List of suggested product certifications.',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'Name of product certifications.',
              },
            },
            required: ['label'],
            additionalProperties: false,
          },
        },
      },
      required: ['suggestions'],
      additionalProperties: false,
    },
    strict: true,
  },
};

const json_schema7 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_certifications',
    schema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          description: 'A list of certification suggestions.',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'Name of certification.',
              },
            },
            required: ['label'],
            additionalProperties: false,
          },
        },
      },
      required: ['suggestions'],
      additionalProperties: false,
    },
    strict: true,
  },
};

const json_schema8 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_facilities_infrastructure',
    schema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          description: 'List of suggested facilities infrastructures.',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'Name of facilities infrastructure.',
              },
            },
            required: ['label'],
            additionalProperties: false,
          },
        },
      },
      required: ['suggestions'],
      additionalProperties: false,
    },
    strict: true,
  },
};

const json_schema9 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_inspection_techniques',
    schema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          description: 'A list of suggested inspection techniques.',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'Name of inspection techniques.',
              },
            },
            required: ['label'],
            additionalProperties: false,
          },
        },
      },
      required: ['suggestions'],
      additionalProperties: false,
    },
    strict: true,
  },
};

const json_schema10 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_regions',
    schema: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          description:
            "List of country suggestions based on procurement manager's requirement.",
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'Name of Country.',
              },
            },
            required: ['label'],
            additionalProperties: false,
          },
        },
      },
      required: ['suggestions'],
      additionalProperties: false,
    },
    strict: true,
  },
};

const json_schema11 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_supplier_names',
    schema: {
      type: 'object',
      properties: {
        names: {
          type: 'array',
          description: 'List of supplier names',
          items: {
            type: 'object',
            properties: {
              label: {
                type: 'string',
                description: 'Name of Supplier.',
              },
            },
            required: ['label'],
          },
        },
      },
      required: ['names'],
    },
  },
};

const json_schema12 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_supplier_revenue',
    schema: {
      type: 'object',
      properties: {
        revenue: {
          type: 'string',
          description: 'Revenue of the supplier in USD.',
        },
      },
      required: ['revenue'],
    },
  },
};

const json_schema13 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_supplier_certifications',
    schema: {
      type: 'object',
      properties: {
        certifications: {
          type: 'array',
          description: 'List of supplier certifications',
          items: {
            type: 'string',
            description: 'Certification of Supplier.',
          },
        },
      },
      required: ['certifications'],
    },
  },
};

const json_schema14 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_supplier_contact',
    schema: {
      type: 'object',
      properties: {
        contact: {
          type: 'object',
          properties: {
            phone: {
              type: 'string',
              description: 'Phone number of the supplier.',
            },
            address: {
              type: 'string',
              description: 'Address of the supplier.',
            },
            email: {
              type: 'string',
              description: 'Email of the supplier.',
            },
          },
          required: ['phone', 'address', 'email'],
        },
      },
      required: ['contact'],
    },
  },
};

const json_schema15 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_supplier_manufacturing_capabilities',
    schema: {
      type: 'object',
      properties: {
        capabilities: {
          type: 'array',
          description: 'List of manufacturing capabilities of the supplier',
          items: {
            type: 'string',
            description: 'Manufacturing capability of the supplier.',
          },
        },
      },
      required: ['capabilities'],
    },
  },
};

const json_schema16 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_supplier_export_countries',
    schema: {
      type: 'object',
      properties: {
        countries: {
          type: 'array',
          description: 'List of export countries of the supplier',
          items: {
            type: 'string',
            description: 'country of export.',
          },
        },
      },
      required: ['countries'],
    },
  },
};

const json_schema17 = {
  type: 'json_schema',
  json_schema: {
    name: 'get_part_description',
    schema: {
      type: 'object',
      properties: {
        part_description: {
          type: 'string',
          description: 'Part description from user input.',
        },
      },
      required: ['part_description'],
    },
  },
};


const order_form_schema = {
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

const materialTypeSuggestionsSystem: string = `You are an expert manufacturing consultant with extensive knowledge of industrial materials.
Your role is to analyze the procurement manager's requirements and provide intelligent material recommendations.
Only include material type with each word capitalized (Title Case) and without any extra information or explanations.

Follow these steps in your response:

1. ANALYSIS STEP:
- If a specific material is mentioned (e.g., "stainless steel 304"):
  * Focus ONLY on alternative grades having similar properties within the SAME material family
- If the request does not specify any specific material:
  * Analyze what the user needs and come up with commonly used materials for that application

2. RECOMMENDATION STEP:
Based on your analysis from step-1, Provide 2-4 material suggestions with the following details for each:
- Full material name
- Specific grade where applicable
- Each suggestion must be unique and not mentioned in the original requirement

Material Selection Criteria:
- Commercial Availability: Focus on readily available materials in standard industrial supply chains
- Performance Characteristics: Match material properties to application requirements`;

const manufacturingProcessSuggestionsSystem: string = `You are an expert manufacturing consultant with extensive knowledge of industrial processes.
Your role is to analyze the manufacturing requirements and provide intelligent process recommendations.
Only include manufacturing process with each word capitalized (Title Case) and without any extra information or explanations.

Follow these steps in your response:

1. ANALYSIS STEP:
- If a specific manufacturing process is mentioned (e.g., "injection molding"):
    * Focus ONLY on variations and sub-types of that process family
- If no specific process is mentioned:
    * Analyze the part requirements (geometry, material, tolerances)
    * Identify suitable manufacturing process based on part analysis above

2. RECOMMENDATION STEP:
Based on your analysis from step-1, provide 2-4 process recommendations with the following details for each:
- Process name and any relevant sub-types
- Each suggestion must be unique and not mentioned in the original requirement
`


const secondaryOperationsSuggestionsSystem: string = `You are an expert manufacturing consultant specializing in secondary operations and post-processing.
Your role is to analyze the manufacturing requirements and provide intelligent recommendations for secondary operations.
Only include secondary operations with each word capitalized (Title Case) and without any extra information or explanations.

Follow these steps in your response:

1. ANALYSIS STEP:
- If specific secondary operations are mentioned:
    * Focus on suggesting complementary operations.
- If no specific operations are mentioned:
    * Analyze the part requirements:
        - Surface finish requirements
        - Dimensional tolerances
        - Aesthetic requirements
        - Functional requirements
        - Material properties

2. RECOMMENDATION STEP:
Based on your analysis from step 1, provide 3-5 recommendations for secondary operations with the following details for each:
- Operation name
- Each recommendation must be unique and not mentioned in the original requirement

Selection Criteria:
- Process Compatibility: Ensure compatibility with the base material and primary manufacturing process.`;

const finishingSuggestionsSystem: string = `You are an expert manufacturing consultant with extensive knowledge of industrial finishing operations.
Your role is to analyze the manufacturing requirements and provide intelligent process recommendations for finishing the product, but only if the requirements can be adequately fulfilled.
Only include the finishing process name with each word capitalized (Title Case) and without any extra information or explanations.

Follow these steps in your response:

1. ANALYSIS STEP:
- If a specific finishing process is mentioned (e.g., "painting", "polishing", "powder coating", "zinc plating"):
    * Focus ONLY on variations and sub-types of that finishing process family
- If no specific finishing process is mentioned:
    * Analyze the part requirements (material, appearance, protective needs)

2. RECOMMENDATION STEP:
Based on your analysis from step-1, provide a recommendation ONLY if you identify a finishing process that can adequately fulfill the requirements. Include the following details:
- Finish name
- Each recommendation must be unique and not mentioned in the original requirement

Finishing Process Selection Criteria:
- Compatibility with base material and previous manufacturing steps`;

const productCertificationsSuggestionsSystem: string = `As an AI manufacturing consultant, please review the order form and provide the following: 
Suggest product certifications that are suitable and relevant for the procurement manager's requirement based on the details provided in the requirement. 
Product certifications are certifications like CE, UL, or CSA that validate the safety and compliance of specific products.
Only include the product certification names without any extra information or explanations.
Each suggestion must be unique and not mentioned in the original requirement.`;

const certificationsSuggestionsSystem: string = `As an AI manufacturing consultant, please review the order form and Suggest company certifications names that are suitable and relevant for the procurement manager's requirement based on the details provided in the requirement. 
Company certifications include standards like ISO and IATF that signify a company's adherence to quality and operational excellence.
Only include the certification names without any extra information or explanations.
Each suggestion must be unique and not mentioned in the original requirement.`;

const facilitiesInfrastructureSuggestionsSystem: string = `You are an expert manufacturing consultant with extensive knowledge of industrial facilities and infrastructure.

Your task is to analyze the procurement manager's requirements and provide recommendations specifically focused on manufacturing-related facilities and infrastructure.

Follow these steps in your response:

1. ANALYSIS STEP:
- If a specific facility need is mentioned (e.g., "paint room"):
  * Focus ONLY on related infrastructure or facility requirements that would complement or support that specific need.
- If no specific facility is mentioned:
  * Analyze the procurement manager's requirements and suggest commonly necessary manufacturing facilties and infrastructure for similar manufacturing operations.

2. RECOMMENDATION STEP:
Based on your analysis from Step 1, provide 3-5 manufacturing facility infrastructure suggestions with the following details for each:
- Full facility/infrastructure name
- Each suggestion must be unique and not mentioned in the original requirement
`

const inspectionTechniquesSuggestionsSystem: string = `You are an expert manufacturing quality control specialist with extensive knowledge of various inspection techniques.
Your task is to analyze the user's requirements and provide intelligent recommendations on the most suitable inspection techniques to ensure product quality and compliance.
Only include the inspection techniques with each word capitalized (Title Case) and without any extra information or explanations.

Follow these steps in your response:

1. ANALYSIS STEP:
- Identify the key product characteristics, including materials, dimensions, and manufacturing processes based on the user's description.
- Determine the critical quality attributes that need verification through inspection, such as surface integrity, dimensional accuracy, and functionality.

2. RECOMMENDATION STEP:
Based on your analysis, provide 3-5 tailored inspection technique recommendations that include the following details for each technique:
- Name of the Inspection Technique
- Each recommendation must be unique and not mentioned in the original requirement

Inspection Technique Selection Criteria:
- Effectiveness: The technique must accurately detect and measure the relevant quality attributes.`


const orderFormPrompt: string = `
A procurement manager has provided you with a requirement for placing an order. Extract and provide information based on below guidelines:
    
                Guidelines for extraction:
                - order_summary: A well articulated summary of the procurement manager's requirement in a maximum of 50 words
                - material_type: Extract ONLY if specific material type is mentioned 
                - manufacturing_process: Extract ONLY if specific manufacturing methods are mentioned
                - secondary_operations: Extract ONLY if specific secondary operations are explicitly stated
                - finishing: Extract ONLY if specific finishing processes are mentioned
                - product_certifications: Extract ONLY if specific product certifications are listed
                - certifications: Extract ONLY if specific company/quality certifications are mentioned
                - facilities_infrastructure: Extract ONLY if specific facility requirements are stated
                - inspection_techniques: Extract ONLY if specific inspection methods are mentioned
                - region: Extract ONLY if location is explicitly specified`

const regionSuggestionsSystem: string = `As an AI manufacturing consultant, please review the order form, and Suggest countries that would be suitable for the procurement manager's requirement based on the details provided in the requirement.
Only include the country names with each word capitalized (Title Case) and without any extra information or explanations.`;


export const prompts = {
  material_type: materialTypeSuggestionsSystem,
  manufacturing_process: manufacturingProcessSuggestionsSystem,
  secondary_operations: secondaryOperationsSuggestionsSystem,
  finishing: finishingSuggestionsSystem,
  product_certifications: productCertificationsSuggestionsSystem,
  certifications: certificationsSuggestionsSystem,
  facilities_infrastructure: facilitiesInfrastructureSuggestionsSystem,
  inspection_techniques: inspectionTechniquesSuggestionsSystem,
  regions: regionSuggestionsSystem,
  orderFormPrompt:orderFormPrompt
};

export const schemas = {
  material_type: json_schema2,
  manufacturing_process: json_schema3,
  secondary_operations: json_schema4,
  finishing: json_schema5,
  product_certifications: json_schema6,
  certifications: json_schema7,
  facilities_infrastructure: json_schema8,
  inspection_techniques: json_schema9,
  regions: json_schema10,
  get_supplier_names: json_schema11,
  get_supplier_revenue: json_schema12,
  get_supplier_certifications: json_schema13,
  get_supplier_contact: json_schema14,
  get_supplier_manufacturing_capabilities: json_schema15,
  get_supplier_export_countries: json_schema16,
  get_part_description: json_schema17,
  order_form_schema:order_form_schema
};

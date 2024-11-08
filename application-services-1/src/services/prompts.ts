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
Based on your analysis from step-1, Provide 3-5 material suggestions with the following details for each:
- Full material name
- Specific grade where applicable

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
Based on your analysis from step-1, provide 3-5 process recommendations with the following details for each:
- Process name and any relevant sub-types`;

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
Based on your analysis from step 1, provide 3-5 recommendations for secondary operations.

For each recommended operation, provide:
- Operation name

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

Finishing Process Selection Criteria:
- Compatibility with base material and previous manufacturing steps`;

const productCertificationsSuggestionsSystem: string = `As an AI manufacturing consultant, please review the order form and provide the following: 
Suggest product certifications that are suitable and relevant for the procurement manager's requirement based on the details provided in the requirement. 
Product certifications are certifications like CE, UL, or CSA that validate the safety and compliance of specific products.
Only include the product certification names without any extra information or explanations.`;

const regionSuggestionsSystem: string = `As an AI manufacturing consultant, please review the order form, and Suggest countries that would be suitable for the procurement manager's requirement based on the details provided in the requirement.
Only include the country names with each word capitalized (Title Case) and without any extra information or explanations.`;

const certificationsSuggestionsSystem: string = `As an AI manufacturing consultant, please review the order form and Suggest company certifications names that are suitable and relevant for the procurement manager's requirement based on the details provided in the requirement. 
Company certifications include standards like ISO and IATF that signify a company's adherence to quality and operational excellence.
Only include the certification names without any extra information or explanations.`;

const facilitiesInfrastructureSuggestionsSystem: string = `You are an expert manufacturing consultant with extensive knowledge of industrial facilities and infrastructure.

Your task is to analyze the procurement manager's requirements and provide recommendations on the necessary facilities and infrastructure to support their operational needs.

Follow these steps in your response:

1. ANALYSIS STEP:
- If a specific facility need is mentioned (e.g., "paint room"):
  * Focus ONLY on related infrastructure or facility requirements that would complement or support that specific need.
- If no specific facility is mentioned:
  * Analyze the procurement manager's general requirements and suggest commonly necessary infrastructure for similar manufacturing operations.

2. RECOMMENDATION STEP:
Based on your analysis from Step 1, provide 3-5 facility infrastructure suggestions with the following details for each:
- Full facility/infrastructure name`;

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

Inspection Technique Selection Criteria:
- Effectiveness: The technique must accurately detect and measure the relevant quality attributes.`;

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
};



export const CRUDPromptRoute = {
    LIST_PROMPTS: 'prompts',
    GET_PROMPT: 'prompts/:promptId',
    CREATE_PROMPT: 'prompts',
    UPDATE_PROMPT: 'prompts/:promptId',
    EXECUTE_WITH_USER_PROMPT: 'prompts/:promptId/executeWithUserPrompt',
    EXECUTE_WITHOUT_USER_PROMPT: 'prompts/:promptId/executeWithoutUserPrompt',
    GET_EXECUTION_LOGS: 'prompts/:promptId/logs'
} as const;

export type CRUDPromptRouteType = typeof CRUDPromptRoute[keyof typeof CRUDPromptRoute];
import { IsString, IsObject, IsOptional, IsEnum, ValidateNested, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

import { CRUDPromptRouteType, CRUDPromptRoute } from './promptCRUD.interfaces';
import { CRUDToolRouteType, CRUDToolRoute } from './toolCRUD.interfaces';

export const CRUDOperationName = {
    GET: 'GET',
    POST: 'POST',
    PUT: 'PUT'
} as const;

export type CRUDOperationNameType = typeof CRUDOperationName[keyof typeof CRUDOperationName];



export class CRUDRouteParams {
    @IsOptional()
    @IsString()
    promptId?: string;
}

export class CRUDFunctionInput {
    @IsString()
    @IsEnum(CRUDOperationName)
    CRUDOperationName: CRUDOperationNameType;

    @IsString()
    @IsEnum(CRUDPromptRoute || CRUDToolRoute)
    CRUDRoute: CRUDPromptRouteType | CRUDToolRouteType;

    @IsOptional()
    @IsObject()
    CRUDBody?: any;

    @IsOptional()
    @ValidateNested()
    @Type(() => CRUDRouteParams)
    routeParams?: CRUDRouteParams;

    @IsOptional()
    @IsObject()
    queryParams?: Record<string, any>;

    // @IsOptional()
    // @IsString()
    // requestId?: string;
}


// not used below, for future reference

export const CRUDFunctionName = {
    promptCRUDV1: 'promptCRUD-V1',
} as const;


export type CRUDFunctionNameType = typeof CRUDFunctionName[keyof typeof CRUDFunctionName];

export class CRUDFunctionNameInput {

    @IsString()
    @IsEnum(CRUDFunctionName)
    functionName: CRUDFunctionNameType;
}

export class CRUDRequest {
    @IsString()
    messageKey: string;

    @IsString()
    userOrgId: string;

    @IsString()
    sourceFunction: string;

    @IsString()
    CRUDFunctionNameInput: CRUDFunctionNameType;

    @ValidateNested()
    @Type(() => CRUDFunctionInput)
    CRUDFunctionInput: CRUDFunctionInput;

    @IsString()
    personRole: string;

    @IsString()
    personId: string;
}



import { BadRequestException, Injectable } from '@nestjs/common';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import { Suggestion } from 'src/interfaces/suggestion.interface';
import { prompts, schemas } from './prompts';
import { KafkaContext } from '@nestjs/microservices';
import { OB1MessageHeader } from 'src/interfaces/ob1-message.interfaces';
import { FindSupplierService } from './find-supplier.service';
import { postMessageToSlackChannel } from './slack-utils';
import { SlackEventHandlingService } from './slack-event-handling.service';
import { NoCapabilitiesService } from './no-capability.service';
import { error } from 'console';
import * as fs from 'fs';
import * as path from 'path';
import * as ffmpeg from 'fluent-ffmpeg';
import OpenAI from 'openai';
@Injectable()
export class DecisionService {
    private openai: OpenAI

  constructor(private kafkaOb1Service: KafkaOb1Service,
     private findSupplierService: FindSupplierService,
     private readonly slackEventHandlingService: SlackEventHandlingService, 
     private readonly noCapabilitiesService: NoCapabilitiesService,
    ) {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
          });
    }

  async decideFunctionCall(functionInput: any,context:KafkaContext): Promise<any> {
    
    try {
    const messageHeaders = context.getMessage().headers as unknown as OB1MessageHeader;
    const messageKey = context.getMessage().key?.toString();
    const files = functionInput.files
    const userQuery = functionInput.userInput
    const token = functionInput.token
    const messageInput = {
      messageContent: {
        functionInput: {
          systemPrompt: prompts.decisionPrompt,
          userPrompt: userQuery,
          responseFormat: schemas.decisionSchema,
          config: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            temperature: 0.7,
            maxTokens: 150,
            topP: 1,
            frequencyPenalty: 0,
            presencePenalty: 0,
          },
        },
        functionName: 'LLMgenerateResponse-V1',
      },
    };

    const processedInput = await this.processInput(functionInput);
    


    const messageInputAdd = {
      messageType: 'REQUEST',
      ...messageInput,
    };

    const response = await this.kafkaOb1Service.sendRequest(
        messageKey,
        messageHeaders.instanceName,
        'agent-services',
        'getSuggestions',
        'service',
        messageInputAdd,
        messageHeaders.userRole,
        messageKey
    );

    // Parse and return the LLM's function decision
    const content =  JSON.parse(response.messageContent.content);
    const functionName = content.function
    let message:any
    console.log("functionName",functionName)
    if (functionName === 'findSupplier') {
        postMessageToSlackChannel(functionInput.fromChannel,{text:"sure on it"},token,functionInput.thread)
        const response =  await this.findSupplierService.findSupplier(
          {...functionInput,projectName:"test1"},
          context,
        );
        const message = "Here is a  <" + response.messageContent.url + "|Google Sheet>"+ " where I have prepared the results for you"
        await postMessageToSlackChannel(functionInput.fromChannel,{text:message},token,functionInput.thread)
      }
    else if(functionName=="getJoke"){
        const response  = await this.slackEventHandlingService.slackreply(functionInput,context)
    }
    else{
        const response  = await this.noCapabilitiesService.noCapability(functionInput,context)
    }
  }
        
 catch (error) {
    }
    console.log("error",error)
  }


  private checkFileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Check if the file is a supported audio format
   * @param filePath Path to the file
   * @returns Boolean indicating if the file is a supported audio format
   */
  private isSupportedAudioFormat(filePath: string): boolean {
    const supportedExtensions = ['.wav', '.mp3'];
    const fileExtension = path.extname(filePath).toLowerCase();
    return supportedExtensions.includes(fileExtension);
  }

  /**
   * Convert audio file to WAV format
   * @param inputPath Path to the input audio file
   * @returns Promise resolving to the output WAV file path
   */
  private convertToWav(inputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const outputPath = path.join(
        path.dirname(inputPath), 
        `${path.basename(inputPath, path.extname(inputPath))}.wav`
      );

      ffmpeg(inputPath)
        .toFormat('wav')
        .on('error', (err) => {
          console.error('Conversion error:', err);
          reject(err);
        })
        .on('end', () => {
          resolve(outputPath);
        })
        .save(outputPath);
    });
  }

  /**
   * Process input and get text (either from audio transcription or user query)
   * @param functionInput Input containing files and user query
   * @returns Promise resolving to text
   */
  async processInput(functionInput: any): Promise<string> {
    const files = functionInput.files;
    console.log("files",JSON.stringify(files))
    const userQuery = functionInput.userInput;

    // If no files or files is empty, use userQuery
    if (!files || files.length === 0) {
      console.log('No files provided. Using user query.');
      return userQuery;
    }

    // Find the first audio file
    const audioFile = files.find(file => 
      this.checkFileExists(file.path) && 
      this.isSupportedAudioFormat(file.path)
    );

    // If no audio file found, use userQuery
    if (!audioFile) {
      console.log('No supported audio file found. Using user query.');
      return userQuery;
    }

    try {
      // If the file is not .wav, convert it
      let wavFilePath = audioFile.path;
      if (path.extname(audioFile.path).toLowerCase() !== '.wav') {
        console.log('Converting audio to WAV format');
        wavFilePath = await this.convertToWav(audioFile.path);
      }

      // Transcribe the WAV file
      console.log('Transcribing audio file');
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(wavFilePath),
        model: 'whisper-1',
        response_format: 'text'
      });

      return transcription || userQuery;
    } catch (error) {
      console.error('Audio transcription error:', error);
      // Fallback to user query if transcription fails
      return userQuery;
    }
  }
}
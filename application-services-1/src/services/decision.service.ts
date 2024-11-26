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
import axios from 'axios'
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
    let userQuery = functionInput.userInput
    const token = functionInput.token
    console.log("files",JSON.stringify(files))
    if (files && files.length > 0) {
        const transcription = await this.processSlackAudioFile(files, token);
        console.log(transcription)
        userQuery = transcription
        functionInput.userInput = transcription
      }

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
    console.log("error in one of decision functions",error)
  }


  /**
   * Download file from Slack
   * @param fileInfo Slack file information
   * @param token Slack authentication token
   * @returns Promise with downloaded file path
   */
  async downloadSlackFile(fileInfo: any, token: string): Promise<string> {
    // Ensure download directory exists
    const downloadDir = path.join(process.cwd(), 'downloads');
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir);
    }

    // Generate a unique filename
    const filename = `${fileInfo.id}_${fileInfo.name}`;
    const filePath = path.join(downloadDir, filename);

    try {
      // Download file using axios to support Slack's private download URLs
      const response = await axios({
        method: 'get',
        url: fileInfo.url_private_download,
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'Slack File Downloader'
        },
        responseType: 'stream'
      });


      // Save the file
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(filePath));
        writer.on('error', reject);
      });
    } catch (error) {
      console.error('Error downloading Slack file:', error);
      throw new Error('Failed to download Slack file');
    }
  }

  /**
   * Convert audio to WAV format
   * @param inputPath Path to input audio file
   * @returns Promise with WAV file path
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
   * Transcribe audio file
   * @param filePath Path to audio file
   * @returns Promise with transcription text
   */
  async transcribeAudio(filePath: string): Promise<string> {
    try {
      // Ensure file is in WAV format
      const wavFilePath = await this.convertToWav(filePath);

      // Transcribe the WAV file
      const transcription = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(wavFilePath),
        model: 'whisper-1',
        response_format: 'text'
      });

      return transcription;
    } catch (error) {
      console.error('Audio transcription error:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  /**
   * Process Slack audio file
   * @param files Slack files array
   * @param token Slack authentication token
   * @returns Promise with transcription text
   */
  async processSlackAudioFile(files: any[], token: string): Promise<string> {
    // Find first audio file
    const audioFile = files.find(file => 
      file.mimetype.startsWith('audio/') || 
      ['mp3', 'wav', 'm4a', 'flac', 'ogg'].includes(file.filetype)
    );

    if (!audioFile) {
      return
    }

    console.log("audioFile",audioFile)

    // Download the file
    const downloadedFilePath = await this.downloadSlackFile(audioFile, token);
    console.log("downloadedFilePath",downloadedFilePath)
    // Transcribe the downloaded audio file
    const transcription = await this.transcribeAudio(downloadedFilePath);

    // Optionally, clean up the downloaded file
    try {
      fs.unlinkSync(downloadedFilePath);
    } catch (cleanupError) {
      console.error('Error cleaning up downloaded file:', cleanupError);
    }

    return transcription;
  }
}
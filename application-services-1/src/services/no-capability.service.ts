import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { KafkaOb1Service } from 'src/kafka-ob1/kafka-ob1.service';
import { TavilySearchService } from './tavily-search.service';
// import { GoogleSheetService } from './google-sheet.service';
import { schemas } from './prompts';
import axios from 'axios';
// import { IncomingWebhook } from '@slack/webhook';

import {
  OB1MessageHeader,
  OB1MessageValue,
  CURRENT_SCHEMA_VERSION,
} from 'src/interfaces/ob1-message.interfaces';
import { SlackChannelService } from './slack-channel-service';

@Injectable()
export class NoCapabilitiesService implements OnModuleInit {
    private readonly slackBotToken = process.env.slack_token //PlexTestOrg1
    private readonly webhookURL = process.env.webhookURL //webhook URL
    // private readonly webhook : IncomingWebhook//webhook URL

  constructor(
    // private readonly kafkaService: KafkaOb1Service,
    // private readonly slackService: SlackChannelService,
  ) {
    // this.webhook = new IncomingWebhook(this.webhookURL);
  }

  async onModuleInit() {}

  async noCapability(functionInput: any, context: KafkaContext) {
    const channel = functionInput.fromChannel;
    const threadTs = functionInput.thread;

    const plexReply = 'I do not have the capability to handle your request currently. Please let me know if you need my help in any of the following';
    console.log('Response from Plex', plexReply);

    await this.sendMessage(channel, plexReply, threadTs);
  }

  private async sendMessage(channel: string, text: string, threadTs: string) {
    try {
        const payload: any = { channel, text };
        if (threadTs) {
          payload.thread_ts = threadTs; // Include thread_ts if provided
        }
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.slackBotToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      console.log('Reply sent', text)
    } catch (error) {
      console.error('Error sending message:', error.response?.data || error.message);
    }
  }
}

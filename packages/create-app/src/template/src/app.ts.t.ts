import { when } from '../../utils.js';
import { CreateAppContext } from '../../types.js';

export default ({
  platforms,
  recognizer,
  withWebview,
}: CreateAppContext): string => `
import Sociably from '@sociably/core';
import Http from '@sociably/http';${when(platforms.includes('facebook'))`
import Facebook from '@sociably/facebook';${when(withWebview)`
import FacebookWebview from '@sociably/facebook/webview';`}`}${when(
  platforms.includes('instagram'),
)`
import Instagram from '@sociably/instagram';${when(withWebview)`
import InstagramWebview from '@sociably/instagram/webview';`}`}${when(
  platforms.includes('whatsapp'),
)`
import WhatsApp from '@sociably/whatsapp';${when(withWebview)`
import WhatsAppWebview from '@sociably/whatsapp/webview';`}`}${when(
  platforms.includes('twitter'),
)`
import Twitter from '@sociably/twitter';${when(withWebview)`
import TwitterWebview from '@sociably/twitter/webview';`}`}${when(
  platforms.includes('telegram'),
)`
import Telegram from '@sociably/telegram';${when(withWebview)`
import TelegramWebview from '@sociably/telegram/webview';`}`}${when(
  platforms.includes('line'),
)`
import Line from '@sociably/line';${when(withWebview)`
import LineWebview from '@sociably/line/webview';`}`}${when(withWebview)`
import Webview from '@sociably/webview';`}
import Script from '@sociably/script';
import RedisState from '@sociably/redis-state';
import {
  FileState,${when(recognizer === 'regex')`
  RegexRecognition,`}
} from '@sociably/dev-tools';${when(recognizer === 'dialogflow')`
import Dialogflow from '@sociably/dialogflow';`}${when(withWebview)`
import nextConfigs from '../webview/next.config.mjs';`}
import useIntent from './services/useIntent.js';
import useUserProfile from './services/useUserProfile.js';
import recognitionData from './recognitionData.js';
import * as scenes from './scenes/index.js';

const {
  // basic
  APP_NAME,
  NODE_ENV,
  PORT,${when(withWebview)`
  DOMAIN,
  // webview
  WEBVIEW_AUTH_SECRET,`}${when(
    platforms.includes('facebook') ||
      platforms.includes('instagram') ||
      platforms.includes('whatsapp'),
  )`
  // meta
  META_APP_ID,
  META_APP_SECRET,
  META_WEBHOOK_VERIFY_TOKEN,`}${when(platforms.includes('facebook'))`
  // facebook
  FACEBOOK_PAGE_ID,
  FACEBOOK_ACCESS_TOKEN,`}${when(platforms.includes('instagram'))`
  // instagram
  INSTAGRAM_AGENT_ID,
  INSTAGRAM_PAGE_ID,
  INSTAGRAM_ACCESS_TOKEN,
  INSTAGRAM_AGENT_USERNAME,`}${when(platforms.includes('whatsapp'))`
  // whatsapp
  WHATSAPP_BUSINESS_ACCOUNT_ID,
  WHATSAPP_PHONE_NUMBER,
  WHATSAPP_NUMBER_ID,
  WHATSAPP_ACCESS_TOKEN,`}${when(platforms.includes('twitter'))`
  // twitter
  TWITTER_AGENT_ID,
  TWITTER_APP_KEY,
  TWITTER_APP_SECRET,
  TWITTER_BEARER_TOKEN,
  TWITTER_ACCESS_TOKEN,
  TWITTER_TOKEN_SECRET,`}${when(platforms.includes('telegram'))`
  // telegram
  TELEGRAM_BOT_NAME,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_SECRET_TOKEN,`}${when(platforms.includes('line'))`
  // line
  LINE_PROVIDER_ID,
  LINE_CHANNEL_ID,
  LINE_ACCESS_TOKEN,
  LINE_CHANNEL_SECRET,${when(withWebview)`
  LINE_LIFF_ID,`}`}
  // redis
  REDIS_URL,${when(recognizer === 'dialogflow')`
  // dialogflow
  DIALOGFLOW_PROJECT_ID,`}
} = process.env as Record<string, string>;

const DEV = NODE_ENV === 'development';

type CreateAppOptions = {
  noServer?: boolean;
};

const createApp = (options?: CreateAppOptions) => {
  return Sociably.createApp({
    modules: [
      Http.initModule({
        entryUrl: \`https://\${DOMAIN}\`,
        noServer: options?.noServer,
        listenOptions: {
          port: PORT ? Number(PORT) : 8080,
        },
      }),

      DEV
        ? FileState.initModule({
            path: './.state_data.json',
          })
        : RedisState.initModule({
            connectOptions: {
              url: REDIS_URL,
            },
          }),
${when(recognizer === 'dialogflow')`
      Dialogflow.initModule({
        recognitionData,
        projectId: DIALOGFLOW_PROJECT_ID,
      }),`}${when(recognizer === 'regex')`
      RegexRecognition.initModule({
        recognitionData,
      }),`}
      
      Script.initModule({
        libs: Object.values(scenes),
      }),
    ],

    platforms: [${when(platforms.includes('facebook'))`
      Facebook.initModule({
        webhookPath: 'webhook/facebook',
        appId: META_APP_ID,
        appSecret: META_APP_SECRET,
        webhookVerifyToken: META_WEBHOOK_VERIFY_TOKEN,
        agentSettings:{
          pageId: FACEBOOK_PAGE_ID,
          accessToken: FACEBOOK_ACCESS_TOKEN,
        },
      }),`}${when(platforms.includes('instagram'))`

      Instagram.initModule({
        webhookPath: 'webhook/instagram',
        appId: META_APP_ID,
        appSecret: META_APP_SECRET,
        webhookVerifyToken: META_WEBHOOK_VERIFY_TOKEN,
        agentSettings: {
          accountId: INSTAGRAM_AGENT_ID,
          pageId: INSTAGRAM_PAGE_ID,
          accessToken: INSTAGRAM_ACCESS_TOKEN,
          username: INSTAGRAM_AGENT_USERNAME,
        },
      }),`}${when(platforms.includes('whatsapp'))`

      WhatsApp.initModule({
        webhookPath: 'webhook/whatsapp',
        appId: META_APP_ID,
        appSecret: META_APP_SECRET,
        accessToken: WHATSAPP_ACCESS_TOKEN,
        webhookVerifyToken: META_WEBHOOK_VERIFY_TOKEN,
        agentSettings: {
          businessAccountId: WHATSAPP_BUSINESS_ACCOUNT_ID,
          phoneNumber: WHATSAPP_PHONE_NUMBER,
          numberId: WHATSAPP_NUMBER_ID,
        },
      }),`}${when(platforms.includes('twitter'))`

      Twitter.initModule({
        webhookPath: 'webhook/twitter',
        appKey: TWITTER_APP_KEY,
        appSecret: TWITTER_APP_SECRET,
        bearerToken: TWITTER_BEARER_TOKEN,
        agentSettings: {
          userId: TWITTER_AGENT_ID,
          accessToken: TWITTER_ACCESS_TOKEN,
          tokenSecret: TWITTER_TOKEN_SECRET,
        },
      }),`}${when(platforms.includes('telegram'))`

      Telegram.initModule({
        webhookPath: 'webhook/telegram',
        agentSettings: {
          botToken: TELEGRAM_BOT_TOKEN,
          botName: TELEGRAM_BOT_NAME,
        },
        secretToken: TELEGRAM_SECRET_TOKEN,
      }),`}${when(platforms.includes('line'))`

      Line.initModule({
        webhookPath: 'webhook/line',
        agentSettings: {
          providerId: LINE_PROVIDER_ID,
          channelId: LINE_CHANNEL_ID,
          accessToken: LINE_ACCESS_TOKEN,
          channelSecret: LINE_CHANNEL_SECRET,${when(withWebview)`
          liff: { default: LINE_LIFF_ID },`}
        },`}
      }),${when(withWebview)`

      Webview.initModule<${when(platforms.includes('facebook'))`
        | FacebookWebview`}${when(platforms.includes('instagram'))`
        | InstagramWebview`}${when(platforms.includes('whatsapp'))`
        | WhatsAppWebview`}${when(platforms.includes('twitter'))`
        | TwitterWebview`}${when(platforms.includes('telegram'))`
        | TelegramWebview`}${when(platforms.includes('line'))`
        | LineWebview`}
      >({
        webviewPath: 'webview',
        authSecret: WEBVIEW_AUTH_SECRET,
        authPlatforms: [${when(platforms.includes('facebook'))`
          FacebookWebview,`}${when(platforms.includes('instagram'))`
          InstagramWebview,`}${when(platforms.includes('whatsapp'))`
          WhatsAppWebview,`}${when(platforms.includes('twitter'))`
          TwitterWebview,`}${when(platforms.includes('telegram'))`
          TelegramWebview,`}${when(platforms.includes('line'))`
          LineWebview,`}
        ],
        noNextServer: options?.noServer,
        nextServerOptions: {
          dev: DEV,
          dir: './webview',
          conf: nextConfigs,
        },
        basicAuth: {
          appName: APP_NAME,
          appIconUrl: 'https://sociably.js.org/img/logo.jpg',
        },
      }),`}
    ],

    services: [
      useIntent,
      useUserProfile,
    ],
  });
};

export default createApp;
`;

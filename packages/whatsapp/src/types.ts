import type {
  NativeComponent,
  EventMiddleware,
  DispatchMiddleware,
  PlatformUtilities,
  SociablyNode,
} from '@sociably/core';
import type { DispatchFrame } from '@sociably/core/engine';
import type { MaybeContainer, Interfaceable } from '@sociably/core/service';
import type { IntermediateSegment } from '@sociably/core/renderer';
import type { WebhookMetadata } from '@sociably/http/webhook';
import type {
  MetaApiJob,
  MetaApiResult,
  MetaApiDispatchResponse,
  MetaApiUploadingFile,
} from '@sociably/meta-api';
import type { WhatsAppBot } from './Bot.js';
import type WhatsAppChat from './Chat.js';
import type { AgentSettingsAccessorI } from './interface.js';
import type { WhatsAppEvent } from './event/types.js';

export * from './event/types.js';

export type WhatsAppSegmentValue = {
  message: Omit<CreateMessageData, 'to' | 'messaging_product'>;
  file?: MetaApiUploadingFile & {
    contentType: string;
  };
  assetTag?: string;
};

export type WhatsAppComponent<
  Props,
  Segment extends
    IntermediateSegment<WhatsAppSegmentValue> = IntermediateSegment<WhatsAppSegmentValue>,
> = NativeComponent<Props, Segment>;

export type WhatsAppEventContext = {
  platform: 'whatsapp';
  event: WhatsAppEvent;
  metadata: WebhookMetadata;
  bot: WhatsAppBot;
  reply(message: SociablyNode): Promise<null | MetaApiDispatchResponse>;
};

export type WhatsAppEventMiddleware = EventMiddleware<
  WhatsAppEventContext,
  null
>;

export type WhatsAppDispatchFrame = DispatchFrame<WhatsAppChat, MetaApiJob>;

export type WhatsAppDispatchMiddleware = DispatchMiddleware<
  MetaApiJob,
  WhatsAppDispatchFrame,
  MetaApiResult
>;

export type WhatsAppAgentSettings = {
  /** Complete phone number in E.164 format */
  phoneNumber: string;
  /** Phone number ID */
  numberId: string;
  /** Business account ID that the number belongs to */
  businessAccountId: string;
};

export type WhatsAppBusinessAccountSettings = {
  /** Business account ID that the numbers belongs to */
  businessAccountId: string;
  numbers: {
    /** Phone number ID */
    numberId: string;
    /** Complete phone number. It must include the country code with "+" prefix */
    phoneNumber: string;
  }[];
};

export type WhatsAppConfigs = {
  /** Agent number settings in single agent mode */
  agentSettings?: WhatsAppAgentSettings;
  /** Agent number settings in multi agent mode */
  multiAgentSettings?: WhatsAppBusinessAccountSettings[];
  /** Host number integration settings by your own service */
  agentSettingsService?: Interfaceable<AgentSettingsAccessorI>;
  /** The access token for the app */
  accessToken: string;
  /** The Facebook app ID */
  appId: string;
  /** The Facebook app secret */
  appSecret: string;
  /** To verify the webhook request by the signature or not. Default to `true` */
  shouldVerifyRequest?: boolean;
  /** To handle the webhook challenge request or not. Default to `true` */
  shouldHandleChallenge?: boolean;
  /** The verify token for registering webhook */
  webhookVerifyToken: string;
  /** The webhook path to receive events. Default to `.` */
  webhookPath?: string;
  /**
   * The webhook subscription fields for WhatsApp account. Default to
   * `['messages']`
   */
  subscriptionFields?: string[];
  /** The graph API version to make API calls */
  graphApiVersion?: string;
  apiBatchRequestInterval?: number;
  eventMiddlewares?: MaybeContainer<WhatsAppEventMiddleware>[];
  dispatchMiddlewares?: MaybeContainer<WhatsAppDispatchMiddleware>[];
};

export type WhatsAppPlatformUtilities = PlatformUtilities<
  WhatsAppEventContext,
  null,
  MetaApiJob,
  WhatsAppDispatchFrame,
  MetaApiResult
>;

/* eslint-disable camelcase */

export type UserProfileData = {
  name: string;
};

export type ContactData = {
  wa_id: string;
  profile: UserProfileData;
};

// TODO: type the raw event object
export type WhatsAppEventData = any;

// TODO: detailed message type
export type MessageData = any;

export type CreateMessageData = {
  audio?: unknown;
  contacts?: unknown;
  document?: unknown;
  image?: unknown;
  interactive?: unknown;
  location?: unknown;
  messaging_product: 'whatsapp';
  status?: unknown;
  sticker?: unknown;
  template?: unknown;
  text?: unknown;
  to: string;
  type?: string;
};

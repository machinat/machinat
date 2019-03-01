// @flow
import type {
  ContainerNativeType,
  ValuesNativeType,
} from 'machinat-renderer/types';
import type { BotPlugin } from 'machinat-base/types';
import type MachinatQueue from 'machinat-queue';
import type { WebhookResponse } from 'machinat-webhook/types';
import type { ChatThread } from './thread';
import typeof { MESSAGE_CREATIVES_THREAD as CreativesThread } from './thread';

type PSIDRecepient = {| id: string |};
type UserRefRecepient = {| user_ref: string |};
type PhoneNumberRecepient = {|
  phone_number: string,
  name?: {| first_name: string, last_name: string |},
|};

export type Recepient = PSIDRecepient | UserRefRecepient | PhoneNumberRecepient;

// TODO: type the raw event object
export type MessengerRawEvent = Object;

// TODO: detailed message type
export type MessengerMessage = Object;

type MessageActionValue = {
  message: MessengerMessage,
};

type SenderActionValue = {
  sender_action: 'mark_seen' | 'typing_on' | 'typing_off',
};

export type MessengerActionValue = MessageActionValue | SenderActionValue;

export type MessengerContainerComponent = ContainerNativeType<MessengerActionValue> & {
  $$entry?: string,
};

export type MessengerValuesComponent = ValuesNativeType<MessengerActionValue> & {
  $$entry?: string,
};

export type MessengerComponent =
  | MessengerContainerComponent
  | MessengerValuesComponent;

export type MessengerRequest = {|
  method: string,
  relative_url: string,
  body: string,
  name?: string,
  depends_on?: string,
  attached_files?: string,
  omit_response_on_success?: boolean,
|};

export type MessengerJob = {|
  request: MessengerRequest,
  threadId: string,
  attachedFileData?: string | Buffer | ReadableStream,
  attachedFileInfo?: {|
    filename?: string,
    filepath?: string,
    contentType?: string,
    knownLength?: number,
  |},
|};

export type MessengerAPIResult = {|
  recipient_id: string,
  message_id: string,
  attachment_id?: string,
|};

export type GraphAPIErrorInfo = {
  message: string,
  type: string,
  code: number,
  error_subcode: number,
  fbtrace_id: string,
};

export type GraphAPIErrorBody = {
  error: GraphAPIErrorInfo,
};

export type MessengerSendOptions = {
  messagingType?: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG',
  tag?: string,
  notificationType?: 'REGULAR' | 'SILENT_PUSH' | 'NO_PUSH',
  personaId?: string,
};

export type MessengerQueue = MachinatQueue<MessengerJob, MessengerAPIResult>;

export type MessengerBotOptions = {
  accessToken: string,
  appSecret?: string,
  shouldValidateRequest: boolean,
  shouldVerifyWebhook: boolean,
  verifyToken?: string,
  respondTimeout: number,
  consumeInterval?: number,
  plugins?: BotPlugin<
    MessengerRawEvent,
    WebhookResponse,
    MessengerActionValue,
    MessengerComponent,
    MessengerJob,
    MessengerAPIResult,
    ChatThread | CreativesThread,
    ChatThread
  >[],
};

import { SociablyNode } from '@sociably/core';
import type { UnitSegment, OutputSegment } from '@sociably/core/renderer';
import { formatNode } from '@sociably/core/utils';
import makeFacebookComponent from '../utils/makeFacebookComponent';
import { PATH_MESSAGES } from '../constant';
import type {
  MessengerSegmentValue,
  MessengerComponent,
  MessageValue,
  SenderActionValue,
} from '../types';

/**
 * @category Props
 */
export type ExpressionProps = {
  /** Content nodes to be annotated. */
  children: SociablyNode;
  /**
   * The messaging type of the message being sent. For more information, see
   * [Sending Messages - Messaging Types](https://developers.facebook.com/docs/messenger-platform/send-messages/#messaging_types).
   * Default to 'RESPONSE'.
   */
  messagingType?: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG';
  /**
   * The message tag to use when messagingType set to 'MESSAGE_TAG'. For more
   * information, see [Message Tags](https://developers.facebook.com/docs/messenger-platform/send-messages/message-tags).
   */
  tag?:
    | 'CONFIRMED_EVENT_UPDATE'
    | 'POST_PURCHASE_UPDATE'
    | 'ACCOUNT_UPDATE'
    | 'HUMAN_AGENT';
  /**
   * Push notification type.
   *  REGULAR: sound/vibration
   *  SILENT_PUSH: on-screen notification only
   *  NO_PUSH: no notification
   * Defaults to 'REGULAR'.
   */
  notificationType?: 'REGULAR' | 'SILENT_PUSH' | 'NO_PUSH';
  /**
   * Custom string that is delivered as a message echo. 1000 character limit.
   */
  metadata?: string;
  /** {@link QuickReply} elements to be sent with messages. */
  quickReplies?: SociablyNode;
  /** The persona id to use. */
  personaId?: string;
};

/**
 * Annotate all the children content with the message settings attributes and
 * append quick replies after the content.
 * @category Component
 * @props {@link ExpressionProps}
 * @guides Check official [doc](https://developers.facebook.com/docs/messenger-platform/send-messages)
 *   and [reference](https://developers.facebook.com/docs/messenger-platform/reference/send-api).
 */
export const Expression: MessengerComponent<
  ExpressionProps,
  OutputSegment<MessengerSegmentValue>
> = makeFacebookComponent(async function Expression(
  {
    props: {
      children,
      messagingType,
      tag,
      notificationType,
      metadata,
      quickReplies,
      personaId,
    },
  },
  _path,
  render
) {
  const [childrenSegments, quickReplySegments] = await Promise.all([
    render<MessengerSegmentValue>(children, '.children'),
    render(quickReplies, '.quickReplies'),
  ]);

  if (childrenSegments === null) {
    return null;
  }

  const segments: OutputSegment<MessengerSegmentValue>[] = [];
  let lastMessageIdx = -1;

  for (const segment of childrenSegments) {
    if (segment.type === 'part') {
      throw new TypeError(
        `part component ${formatNode(
          segment.node
        )} should not be directly placed in <Expression/>`
      );
    }

    // hoisting text to message object
    if (segment.type === 'text') {
      lastMessageIdx = segments.length;

      segments.push({
        type: 'unit',
        value: {
          apiPath: PATH_MESSAGES,
          params: {
            message: { text: segment.value },
            messaging_type: messagingType,
            tag,
            notification_type: notificationType,
            persona_id: personaId,
          },
        },
        node: segment.node,
        path: segment.path,
      });
    } else if (
      (segment.type === 'unit' || segment.type === 'raw') &&
      segment.value.apiPath === PATH_MESSAGES
    ) {
      const {
        value: { apiPath, params, attachFile },
      } = segment;

      if ('message' in params) {
        lastMessageIdx = segments.length;

        segments.push({
          ...segment,
          value: {
            apiPath,
            params: {
              ...params,
              messaging_type: messagingType,
              tag,
              notification_type: notificationType,
              persona_id: personaId,
            },
            attachFile,
          },
        });
      } else if (
        'sender_action' in params &&
        (params.sender_action === 'typing_on' ||
          params.sender_action === 'typing_off')
      ) {
        segments.push({
          ...(segment as UnitSegment<SenderActionValue>),
          value: {
            apiPath,
            params: { ...params, persona_id: personaId },
          },
        });
      } else {
        segments.push(segment as UnitSegment<MessengerSegmentValue>);
      }
    } else if (segment.type !== 'break') {
      segments.push(segment);
    }
  }

  //  attach quick_replies and metadata to last message
  if (lastMessageIdx !== -1) {
    const lastMessageSeg = segments[
      lastMessageIdx
    ] as UnitSegment<MessageValue>;

    const { value } = lastMessageSeg;

    segments.splice(lastMessageIdx, 1, {
      ...lastMessageSeg,
      value: {
        ...value,
        params: {
          ...value.params,
          message: {
            ...value.params.message,
            metadata,
            quick_replies: quickReplySegments?.map((segment) => segment.value),
          },
        },
      },
    });
  }

  return segments;
});

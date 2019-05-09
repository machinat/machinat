import { asPartComponent } from './utils';

const QuickReply = ({ props: { title, payload, imageURL } }) => [
  {
    content_type: 'text',
    title,
    payload,
    image_url: imageURL,
  },
];
const __QuickReply = asPartComponent(QuickReply);

const LOCATION_QUICK_REPLY_VALUES = [{ content_type: 'location' }];
const LocationQuickReply = () => LOCATION_QUICK_REPLY_VALUES;
const __LocationQuickReply = asPartComponent(LocationQuickReply);

const PHONE_QUICK_REPLY_VALUES = [{ content_type: 'user_phone_number' }];
const PhoneQuickReply = () => PHONE_QUICK_REPLY_VALUES;
const __PhoneQuickReply = asPartComponent(PhoneQuickReply);

const EMAIL_QUICK_REPLY_VALUES = [{ content_type: 'user_email' }];
const EmailQuickReply = () => EMAIL_QUICK_REPLY_VALUES;
const __EmailQuickReply = asPartComponent(EmailQuickReply);

export {
  __QuickReply as QuickReply,
  __LocationQuickReply as LocationQuickReply,
  __PhoneQuickReply as PhoneQuickReply,
  __EmailQuickReply as EmailQuickReply,
};

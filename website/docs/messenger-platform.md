---
title: Messenger Platform
sidebar_label: Messenger
---

`@sociably/messenger` platform enable your app to receive/send messages on [Messenger platform](https://developers.facebook.com/docs/messenger-platform/)
as a Facebook page.

## Install

Install the `core`, `http` and `messenger` packages:

```bash
npm install @sociably/core @sociably/http @sociably/messenger
```

## Setup

:::tip
You can check [setup section in the tutorial](https://sociably.js.org/docs/learn/create-app#platform-setup?p=messenger).
It brings you to set up everything step by step.
:::

First you need to apply a Facebook app and set up the page binding.
Follow the [official guide](https://developers.facebook.com/docs/messenger-platform/getting-started/app-setup)
for the setup procedures.

Then set up the `http` and `messenger` modules like this:

```ts
import Sociably from '@sociably/core';
import Http from '@sociably/http';
import Messenger from '@sociably/messenger';

const {
  MESSENGER_PAGE_ID,
  MESSENGER_APP_ID,
  MESSENGER_ACCESS_TOKEN,
  MESSENGER_APP_SECRET,
  MESSENGER_VERIFY_TOKEN,
} = process.env;

const app = Sociably.createApp({
  modules: [
    Http.initModule({ port: 8080 }),
  ],
  platforms: [
    Messenger.intiModule({
      entryPath: '/webhook/messenger',     // webhook path
      pageId: MESSENGER_PAGE_ID,           // Facebook page id
      appSecret: MESSENGER_APP_SECRET,     // Facebook app secret
      accessToken: MESSENGER_ACCESS_TOKEN, // page access token
      verifyToken: MESSENGER_VERIFY_TOKEN, // token for webhook verification
    }),
  ],
});
```

## Usage

Here's an example to receive events and send replies back:

```tsx
import Sociably from '@sociably/core';
import * as Messenger from '@sociably/messenger/components';
import app from './app';

app.onEvent(async ({ platform, event, reply }) => {
  if (platform === 'messenger' && event.type === 'text') {
    await reply(
      <Messenger.Expression
        notificationType="SILENT_PUSH"
        personaId="BOT_PERSONA_ID"
        quickReplies={
          <Messenger.TextReply title="I want 🐶" payload="doggo" />
        }
      >
        Hello Messenger! 👋
        <Messenger.GenericTemplate>
          <Messenger.GenericItem
            title="You daily 🐱"
            imageUrl="https://cataas.com/cat"
            buttons={
              <Messenger.PostbackButton title="More" payload="catto" />
            }
          />
        </Messenger.GenericTemplate>
      </Messenger.Expression>
    );
  }
});
```

Check API references for the details of [events](https://sociably.js.org/api/modules/messenger#messengerevent)
and [components](https://sociably.js.org/api/modules/messenger_components).

## Webview

### Auth Setup

To use [webviews](./embedded-webview) in Messenger,
configure the app with these steps:

1. Add auth provider to the `webview` platform and set app info at the `basicAuth`.
   And make sure you have a state provider installed.
   Like this:

```ts
import Webview from '@sociably/webview';
import RedisState from '@machiniat/redis';
import MessengerAuth from '@sociably/messenger/webview';

const app = Sociably.createApp({
  platforms: [
    Webview.initModule({
      authPlatforms:[
        MessengerAuth
      ],
      basicAuth: {
        appName: 'My Foo App',
        appIconUrl: './webview/img/logo.png'
      },
      // ...
    }),
  ],
  modules: [
    RedisState.initModule({
      clientOptions: {
        url: REDIS_URL,
      },
    }),
  ],
});
```

2. Expose your Facebook page id in `next.config.js`:

```js
const { MESSENGER_PAGE_ID } = process.env;

module.exports = {
  publicRuntimeConfig: {
    // highlight-next-line
    MESSENGER_PAGE_ID,
  },
  // ...
};
```

3. Set up the `WebviewClient` in the webview:

```ts
import getConfig from 'next/config';
import WebviewClient from '@sociably/webview/client';
import MessengerAuth from '@sociably/messenger/webview/client';

const {
  publicRuntimeConfig: { MESSENGER_PAGE_ID },
} = getConfig();

const client =  new WebviewClient({
  authPlatforms: [
    new MessengerAuth({ pageId: MESSENGER_PAGE_ID }),
  ],
});
```

### Open the Webview

The webview can be opened with a `WebviewButton` in the chatroom.
For example:

```tsx
import * as Messenger from '@sociably/messenger/components';
import { WebviewButton as MessengerWebviewButton } from '@sociably/messenger/webview';

app.onEvent(async ({ reply }) => {
  await reply(
    <Messenger.ButtonTemplate
      buttons={
        <MessengerWebviewButton title="Open 📤" />
      }
    >
      Hello Webview!
    </Messenger.ButtonTemplate>
  );
});
```

The user will be asked to enter a login code sent in the chat.
After login, webview can communicate to the server as the authenticated user.

Check the [webview platform document](https://sociably.js.org/docs/embedded-webview)
to learn more.

## Assets Manager

[`MessengerAssetsManager`](https://sociably.js.org/api/classes/messenger_asset.messengerassetsmanager.html)
service helps you to manage resources on the Messenger platform,
like attachments and personas.

To use it, you have to install a [state provider](./using-states) first.
Then register `MessengerAssetsManager` like this:

```ts
import RedisState from '@machiniat/redis';
// highlight-next-line
import MessengerAssetsManager, { saveReusableAttachments } from '@sociably/messenger/asssets';

const app = Sociably.createApp({
  services: [
    // highlight-next-line
    MessengerAssetsManager,
  ],
  platforms: [
    Messenger.initModule({
      // ...
      dispatchMiddlewares: [
        // highlight-next-line
        saveReusableAttachments,
      ]
    }),
  ],
  modules: [
    RedisState.initModule({
      clientOptions: { url: REDIS_URL },
    }),
  ],
});
```

Here is an example to upload a reusable attachment:

```tsx
import fs from 'fs';
import { makeContainer } from '@sociably/core';
import * as Messenger from '@sociably/messenger/components';
import MessengerAssetsManager from '@sociably/messenger/asssets';

app.onEvent(makeContainer({ deps: [MessengerAssetsManager] })(
  (assetsManager) =>
    async ({ reply }) => {
      const fooImageId = await assetsManager.getAttachment('foo.image');

      if (fooImageId) {
        await reply(
          <Messenger.Image attachmentId={fooImageId} />
        );
      } else {
        await reply(
          <Messenger.Image
            reusable
            assetTag="foo.image"
            fileData={fs.createReadStream('./assets/foo.jpg')}
          />
        );
      }
}
));
```

If you upload an attachment with `reusable` and `assetTag` props,
the `saveReusableAttachments` middleware will save the returned attachment id.
You can reuse the saved id for the next time.

## Resources

Here are some resources for further reading:

- [`@sociably/messenger` package reference](https://sociably.js.org/api/modules/messenger.html)
- [Messenger Platform document](https://developers.facebook.com/docs/messenger-platform)

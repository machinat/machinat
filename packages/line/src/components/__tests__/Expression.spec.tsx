import Sociably from '@sociably/core';
import { isNativeType } from '@sociably/core/utils';
import { Expression } from '../Expression';
import { QuickReply } from '../QuickReply';
import { MessageAction } from '../Action';
import { LinkRichMenu } from '../LinkRichMenu';
import { renderUnitElement } from './utils';

it('is valid native component', () => {
  expect(typeof Expression).toBe('function');
  expect(isNativeType(<Expression>foo</Expression>)).toBe(true);
  expect(Expression.$$platform).toBe('line');
});

it('return segments from children', async () => {
  await expect(
    renderUnitElement(
      <Expression>
        <p>foo</p>
        <p>bar</p>
        <p>baz</p>
      </Expression>
    )
  ).resolves.toMatchInlineSnapshot(`
          Array [
            Object {
              "node": <p>
                foo
              </p>,
              "path": "$#Expression.children:0",
              "type": "unit",
              "value": Object {
                "params": Object {
                  "text": "foo",
                  "type": "text",
                },
                "type": "message",
              },
            },
            Object {
              "node": <p>
                bar
              </p>,
              "path": "$#Expression.children:1",
              "type": "unit",
              "value": Object {
                "params": Object {
                  "text": "bar",
                  "type": "text",
                },
                "type": "message",
              },
            },
            Object {
              "node": <p>
                baz
              </p>,
              "path": "$#Expression.children:2",
              "type": "unit",
              "value": Object {
                "params": Object {
                  "text": "baz",
                  "type": "text",
                },
                "type": "message",
              },
            },
          ]
        `);
});

it('hoist children rendered text into text message object', async () => {
  await expect(
    renderUnitElement(
      <Expression>
        foo
        <Sociably.Pause />
        bar
        <Sociably.Pause />
        baz
      </Expression>
    )
  ).resolves.toMatchInlineSnapshot(`
          Array [
            Object {
              "node": "foo",
              "path": "$#Expression.children:0",
              "type": "unit",
              "value": Object {
                "params": Object {
                  "text": "foo",
                  "type": "text",
                },
                "type": "message",
              },
            },
            Object {
              "node": <Sociably.Pause />,
              "path": "$#Expression.children:1",
              "type": "pause",
              "value": null,
            },
            Object {
              "node": "bar",
              "path": "$#Expression.children:2",
              "type": "unit",
              "value": Object {
                "params": Object {
                  "text": "bar",
                  "type": "text",
                },
                "type": "message",
              },
            },
            Object {
              "node": <Sociably.Pause />,
              "path": "$#Expression.children:3",
              "type": "pause",
              "value": null,
            },
            Object {
              "node": "baz",
              "path": "$#Expression.children:4",
              "type": "unit",
              "value": Object {
                "params": Object {
                  "text": "baz",
                  "type": "text",
                },
                "type": "message",
              },
            },
          ]
        `);
});

it('attach quickReply to last message', async () => {
  await expect(
    renderUnitElement(
      <Expression
        quickReplies={
          <>
            <QuickReply>
              <MessageAction label="👮‍" text="Some superhero" />
            </QuickReply>
            <QuickReply>
              <MessageAction label="🧚‍" text="Some fairytale bliss" />
            </QuickReply>
            <QuickReply imageUrl="https://somthing.just.like/this">
              <MessageAction label="💑" text="Somebody I can kiss" />
            </QuickReply>
          </>
        }
      >
        Where you wanna go
        <p>How much you wanna risk</p>
        I'm not looking for
        <LinkRichMenu id="somebody_with_superhuman_gift" />
      </Expression>
    )
  ).resolves.toMatchInlineSnapshot(`
          Array [
            Object {
              "node": "Where you wanna go",
              "path": "$#Expression.children:0",
              "type": "unit",
              "value": Object {
                "params": Object {
                  "text": "Where you wanna go",
                  "type": "text",
                },
                "type": "message",
              },
            },
            Object {
              "node": <p>
                How much you wanna risk
              </p>,
              "path": "$#Expression.children:1",
              "type": "unit",
              "value": Object {
                "params": Object {
                  "text": "How much you wanna risk",
                  "type": "text",
                },
                "type": "message",
              },
            },
            Object {
              "node": "I'm not looking for",
              "path": "$#Expression.children:2",
              "type": "unit",
              "value": Object {
                "params": Object {
                  "quickReply": Object {
                    "items": Array [
                      Object {
                        "action": Object {
                          "label": "👮‍",
                          "text": "Some superhero",
                          "type": "message",
                        },
                        "imageUrl": undefined,
                        "type": "action",
                      },
                      Object {
                        "action": Object {
                          "label": "🧚‍",
                          "text": "Some fairytale bliss",
                          "type": "message",
                        },
                        "imageUrl": undefined,
                        "type": "action",
                      },
                      Object {
                        "action": Object {
                          "label": "💑",
                          "text": "Somebody I can kiss",
                          "type": "message",
                        },
                        "imageUrl": "https://somthing.just.like/this",
                        "type": "action",
                      },
                    ],
                  },
                  "text": "I'm not looking for",
                  "type": "text",
                },
                "type": "message",
              },
            },
            Object {
              "node": <LinkRichMenu
                id="somebody_with_superhuman_gift"
              />,
              "path": "$#Expression.children:3",
              "type": "unit",
              "value": Object {
                "getBulkRequest": [Function],
                "getChatRequest": [Function],
                "type": "chat_action",
              },
            },
          ]
        `);
});

it('return null if children is empty', async () => {
  await expect(
    renderUnitElement(<Expression quickReplies={[]}>{undefined}</Expression>)
  ).resolves.toBe(null);
});

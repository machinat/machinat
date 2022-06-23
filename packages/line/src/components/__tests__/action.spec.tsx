import Sociably from '@sociably/core';
import { isNativeType } from '@sociably/core/utils';
import {
  PostbackAction,
  MessageAction,
  UriAction,
  DateTimePickerAction,
  CameraAction,
  CameraRollAction,
  LocationAction,
} from '../action';
import { renderInner } from './utils';

test.each(
  [
    PostbackAction,
    MessageAction,
    UriAction,
    DateTimePickerAction,
    CameraAction,
    CameraAction,
    CameraRollAction,
    LocationAction,
  ].map((C) => [C.name, C])
)('%s is valid native Component', (_, Action: any) => {
  expect(typeof Action).toBe('function');
  expect(isNativeType(<Action />)).toBe(true);
  expect(Action.$$platform).toBe('line');
});

test('<PostbackAction/>', async () => {
  await expect(
    renderInner(
      <PostbackAction
        data="__POSTBACK_FOO__"
        label="Hello!"
        displayText="WORLD!"
      />
    )
  ).resolves.toMatchInlineSnapshot(`
          Array [
            Object {
              "node": <PostbackAction
                data="__POSTBACK_FOO__"
                displayText="WORLD!"
                label="Hello!"
              />,
              "path": "$#container",
              "type": "part",
              "value": Object {
                "data": "__POSTBACK_FOO__",
                "displayText": "WORLD!",
                "label": "Hello!",
                "type": "postback",
              },
            },
          ]
        `);
});

test('<MessageAction/>', async () => {
  await expect(renderInner(<MessageAction label="Tick" text="Tock" />)).resolves
    .toMatchInlineSnapshot(`
          Array [
            Object {
              "node": <MessageAction
                label="Tick"
                text="Tock"
              />,
              "path": "$#container",
              "type": "part",
              "value": Object {
                "label": "Tick",
                "text": "Tock",
                "type": "message",
              },
            },
          ]
        `);
});

test('<UriAction/>', async () => {
  await expect(
    renderInner(<UriAction uri="http://sociably.js.org" label="Try it!" />)
  ).resolves.toMatchInlineSnapshot(`
          Array [
            Object {
              "node": <UriAction
                label="Try it!"
                uri="http://sociably.js.org"
              />,
              "path": "$#container",
              "type": "part",
              "value": Object {
                "label": "Try it!",
                "type": "uri",
                "uri": "http://sociably.js.org",
              },
            },
          ]
        `);
});

test('<CameraAction/>', async () => {
  await expect(renderInner(<CameraAction label="Cheer!" />)).resolves
    .toMatchInlineSnapshot(`
          Array [
            Object {
              "node": <CameraAction
                label="Cheer!"
              />,
              "path": "$#container",
              "type": "part",
              "value": Object {
                "label": "Cheer!",
                "type": "camera",
              },
            },
          ]
        `);
});

test('<CameraRollAction/>', async () => {
  await expect(renderInner(<CameraRollAction label="Cheer again!" />)).resolves
    .toMatchInlineSnapshot(`
          Array [
            Object {
              "node": <CameraRollAction
                label="Cheer again!"
              />,
              "path": "$#container",
              "type": "part",
              "value": Object {
                "label": "Cheer again!",
                "type": "cameraRoll",
              },
            },
          ]
        `);
});

test('<LocationAction/>', async () => {
  await expect(renderInner(<LocationAction label="Ok, where are we?" />))
    .resolves.toMatchInlineSnapshot(`
          Array [
            Object {
              "node": <LocationAction
                label="Ok, where are we?"
              />,
              "path": "$#container",
              "type": "part",
              "value": Object {
                "label": "Ok, where are we?",
                "type": "location",
              },
            },
          ]
        `);
});

describe('DateTimePickerAction', () => {
  test('datetime mode', async () => {
    const actions = [
      <DateTimePickerAction
        mode="datetime"
        label="When?"
        data="__MEETUP_DATETIME__"
        initial="2000-01-01T00:00"
        min="1990-01-01T00:00"
        max="2020-01-01T00:00"
      />,
      <DateTimePickerAction
        label="When?"
        data="__MEETUP_DATETIME__"
        initial={new Date('2000-01-01T00:00')}
        min={new Date('1990-01-01T00:00')}
        max={new Date('2020-01-01T00:00')}
      />,
    ];

    for (const action of actions) {
      // eslint-disable-next-line no-await-in-loop
      await expect(renderInner(action)).resolves.toEqual([
        {
          type: 'part',
          node: action,
          value: {
            label: 'When?',
            type: 'datetimepicker',
            mode: 'datetime',
            data: '__MEETUP_DATETIME__',
            initial: '2000-01-01T00:00',
            min: '1990-01-01T00:00',
            max: '2020-01-01T00:00',
          },
          path: '$#container',
        },
      ]);
    }
  });

  test('date mode', async () => {
    const actions = [
      <DateTimePickerAction
        mode="date"
        label="Which day?"
        data="__MEETUP_DATE__"
        initial="2000-01-01"
        min="1990-01-01"
        max="2020-01-01"
      />,
      <DateTimePickerAction
        mode="date"
        label="Which day?"
        data="__MEETUP_DATE__"
        initial={new Date(2000, 0)}
        min={new Date(1990, 0)}
        max={new Date(2020, 0)}
      />,
    ];

    for (const action of actions) {
      // eslint-disable-next-line no-await-in-loop
      await expect(renderInner(action)).resolves.toEqual([
        {
          type: 'part',
          node: action,
          value: {
            type: 'datetimepicker',
            mode: 'date',
            label: 'Which day?',
            data: '__MEETUP_DATE__',
            initial: '2000-01-01',
            min: '1990-01-01',
            max: '2020-01-01',
          },
          path: '$#container',
        },
      ]);
    }
  });

  test('time mode', async () => {
    const actions = [
      <DateTimePickerAction
        mode="time"
        label="What time?"
        data="__MEETUP_TIME__"
        initial="11:11"
        min="00:00"
        max="22:22"
      />,
      <DateTimePickerAction
        mode="time"
        label="What time?"
        data="__MEETUP_TIME__"
        initial={new Date(0, 0, 0, 11, 11)}
        min={new Date(0, 0, 0, 0, 0)}
        max={new Date(0, 0, 0, 22, 22)}
      />,
    ];

    for (const action of actions) {
      // eslint-disable-next-line no-await-in-loop
      await expect(renderInner(action)).resolves.toEqual([
        {
          type: 'part',
          node: action,
          value: {
            type: 'datetimepicker',
            mode: 'time',
            label: 'What time?',
            data: '__MEETUP_TIME__',
            initial: '11:11',
            min: '00:00',
            max: '22:22',
          },
          path: '$#container',
        },
      ]);
    }
  });
});

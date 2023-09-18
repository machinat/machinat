import Sociably from '@sociably/core';
import { renderUnitElement, makeTestComponent } from './utils.js';
import {
  Image as _Image,
  Video as _Video,
  Audio as _Audio,
  File as _File,
} from '../Media.js';

const Image = makeTestComponent(_Image);
const Video = makeTestComponent(_Video);
const Audio = makeTestComponent(_Audio);
const File = makeTestComponent(_File);

describe('media Components', () => {
  it('match snapshot', async () => {
    const segments = await renderUnitElement(
      <>
        <Image url="http://this.is/a/picture" reusable />
        <Image attachmentId="_I_am_Image_" />
        <Image file={{ data: '_IMAGE_BINARY_DATA_' }} />
        <Video url="http://this.is/a/video" reusable />
        <Video attachmentId="_I_am_Video_" />
        <Video file={{ data: '_VIDEO_BINARY_DATA_', fileName: 'foo.mp4' }} />
        <Audio url="http://this.is/an/audio" reusable />
        <Audio attachmentId="_I_am_Audio_" />
        <Audio
          file={{ data: '_AUDIO_BINARY_DATA_' }}
          assetTag="foo_audio"
          reusable
        />
        <File url="http://this.is/a/file" reusable />
        <File attachmentId="_I_am_File_" />
        <File
          reusable
          file={{ data: '_FILE_BINARY_DATA_', fileName: 'foo.pdf' }}
          assetTag="foo_file"
        />
      </>,
    );
    expect(segments).toMatchSnapshot();
    expect(segments?.map((seg) => seg.value)).toMatchInlineSnapshot(`
      [
        {
          "apiPath": "me/messages",
          "assetTag": undefined,
          "file": undefined,
          "params": {
            "message": {
              "attachment": {
                "payload": {
                  "attachment_id": undefined,
                  "is_reusable": true,
                  "url": "http://this.is/a/picture",
                },
                "type": "image",
              },
            },
          },
          "type": "message",
        },
        {
          "apiPath": "me/messages",
          "assetTag": undefined,
          "file": undefined,
          "params": {
            "message": {
              "attachment": {
                "payload": {
                  "attachment_id": "_I_am_Image_",
                  "is_reusable": undefined,
                  "url": undefined,
                },
                "type": "image",
              },
            },
          },
          "type": "message",
        },
        {
          "apiPath": "me/messages",
          "assetTag": undefined,
          "file": {
            "data": "_IMAGE_BINARY_DATA_",
          },
          "params": {
            "message": {
              "attachment": {
                "payload": {
                  "attachment_id": undefined,
                  "is_reusable": undefined,
                  "url": undefined,
                },
                "type": "image",
              },
            },
          },
          "type": "message",
        },
        {
          "apiPath": "me/messages",
          "assetTag": undefined,
          "file": undefined,
          "params": {
            "message": {
              "attachment": {
                "payload": {
                  "attachment_id": undefined,
                  "is_reusable": true,
                  "url": "http://this.is/a/video",
                },
                "type": "video",
              },
            },
          },
          "type": "message",
        },
        {
          "apiPath": "me/messages",
          "assetTag": undefined,
          "file": undefined,
          "params": {
            "message": {
              "attachment": {
                "payload": {
                  "attachment_id": "_I_am_Video_",
                  "is_reusable": undefined,
                  "url": undefined,
                },
                "type": "video",
              },
            },
          },
          "type": "message",
        },
        {
          "apiPath": "me/messages",
          "assetTag": undefined,
          "file": {
            "data": "_VIDEO_BINARY_DATA_",
            "fileName": "foo.mp4",
          },
          "params": {
            "message": {
              "attachment": {
                "payload": {
                  "attachment_id": undefined,
                  "is_reusable": undefined,
                  "url": undefined,
                },
                "type": "video",
              },
            },
          },
          "type": "message",
        },
        {
          "apiPath": "me/messages",
          "assetTag": undefined,
          "file": undefined,
          "params": {
            "message": {
              "attachment": {
                "payload": {
                  "attachment_id": undefined,
                  "is_reusable": true,
                  "url": "http://this.is/an/audio",
                },
                "type": "audio",
              },
            },
          },
          "type": "message",
        },
        {
          "apiPath": "me/messages",
          "assetTag": undefined,
          "file": undefined,
          "params": {
            "message": {
              "attachment": {
                "payload": {
                  "attachment_id": "_I_am_Audio_",
                  "is_reusable": undefined,
                  "url": undefined,
                },
                "type": "audio",
              },
            },
          },
          "type": "message",
        },
        {
          "apiPath": "me/messages",
          "assetTag": "foo_audio",
          "file": {
            "data": "_AUDIO_BINARY_DATA_",
          },
          "params": {
            "message": {
              "attachment": {
                "payload": {
                  "attachment_id": undefined,
                  "is_reusable": true,
                  "url": undefined,
                },
                "type": "audio",
              },
            },
          },
          "type": "message",
        },
        {
          "apiPath": "me/messages",
          "assetTag": undefined,
          "file": undefined,
          "params": {
            "message": {
              "attachment": {
                "payload": {
                  "attachment_id": undefined,
                  "is_reusable": true,
                  "url": "http://this.is/a/file",
                },
                "type": "file",
              },
            },
          },
          "type": "message",
        },
        {
          "apiPath": "me/messages",
          "assetTag": undefined,
          "file": undefined,
          "params": {
            "message": {
              "attachment": {
                "payload": {
                  "attachment_id": "_I_am_File_",
                  "is_reusable": undefined,
                  "url": undefined,
                },
                "type": "file",
              },
            },
          },
          "type": "message",
        },
        {
          "apiPath": "me/messages",
          "assetTag": "foo_file",
          "file": {
            "data": "_FILE_BINARY_DATA_",
            "fileName": "foo.pdf",
          },
          "params": {
            "message": {
              "attachment": {
                "payload": {
                  "attachment_id": undefined,
                  "is_reusable": true,
                  "url": undefined,
                },
                "type": "file",
              },
            },
          },
          "type": "message",
        },
      ]
    `);
  });
});

import WebviewConnection from '../Connection';

test('WebviewConnection(serverId, connId)', () => {
  const thread = new WebviewConnection('#server', '#conn');

  expect(thread.platform).toBe('webview');
  expect(thread.type).toBe('connection');
  expect(thread.serverId).toBe('#server');
  expect(thread.id).toBe('#conn');

  expect(thread.uid).toMatchInlineSnapshot(`"webview.#server.#conn"`);
  expect(thread.uniqueIdentifier).toMatchInlineSnapshot(`
    Object {
      "$$typeof": Array [
        "thread",
      ],
      "id": "#conn",
      "platform": "webview",
      "scopeId": "#server",
    }
  `);

  expect(thread.typeName()).toBe('WebviewConnection');
  expect(thread.toJSONValue()).toMatchInlineSnapshot(`
    Object {
      "id": "#conn",
      "server": "#server",
    }
  `);
  expect(WebviewConnection.fromJSONValue(thread.toJSONValue())).toStrictEqual(
    thread
  );
});

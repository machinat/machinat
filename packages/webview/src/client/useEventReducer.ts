import { useReducer, useEffect } from 'react';
import type WebviewClient from './Client.js';
import type { EventValue, AnyClientAuthenticator } from '../types.js';
import type { ClientEventContext, EventContextOfClient } from './types.js';

function useEventReducer<
  T,
  Client extends WebviewClient<
    AnyClientAuthenticator,
    EventValue
  > = WebviewClient<AnyClientAuthenticator, EventValue>,
>(
  client: Client,
  reducer: (currentValue: T, context: EventContextOfClient<Client>) => T,
  initialValue: T,
): T;

function useEventReducer<T>(
  client: WebviewClient<AnyClientAuthenticator, EventValue>,
  reducer: (
    currentValue: T,
    context: ClientEventContext<AnyClientAuthenticator, EventValue>,
  ) => T,
  initialValue: T,
): T {
  const [data, dispatchEvent] = useReducer(reducer, initialValue);

  useEffect(() => {
    const eventListener = (
      context: ClientEventContext<AnyClientAuthenticator, EventValue>,
    ) => {
      dispatchEvent(context);
    };

    client.onEvent(eventListener);
    return () => {
      client.removeEventListener(eventListener);
    };
  }, [client]);

  return data;
}

export default useEventReducer;

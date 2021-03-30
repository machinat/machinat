import {
  MACHINAT_FRAGMENT_TYPE,
  MACHINAT_PAUSE_TYPE,
  MACHINAT_INJECTION_TYPE,
  MACHINAT_THUNK_TYPE,
  MACHINAT_RAW_TYPE,
} from './symbol';
import createMachinatElement from './createElement';
import App from './app';
import BaseBot from './base/Bot';
import BaseProfiler from './base/Profiler';
import BaseMarshaler from './base/Marshaler';
import type {
  AppConfig,
  MachinatElement,
  NativeComponent,
  ContainerComponent,
  AnyMachinatPlatform,
  FragmentProps,
  PauseProps,
  InjectionProps,
  ThunkProps,
  RawProps,
} from './types';

/**
 * @category Root
 */
namespace Machinat {
  export const createElement = createMachinatElement;
  export const createApp = <Platform extends AnyMachinatPlatform>(
    config: AppConfig<Platform>
  ): App<Platform> => {
    const app = new App(config);
    return app;
  };

  export const Fragment = (MACHINAT_FRAGMENT_TYPE as unknown) as (
    props: FragmentProps
  ) => null;

  export const Pause = (MACHINAT_PAUSE_TYPE as unknown) as (
    props: PauseProps
  ) => null;

  export const Injection = (MACHINAT_INJECTION_TYPE as unknown) as (
    props: InjectionProps
  ) => null;

  export const Thunk = (MACHINAT_THUNK_TYPE as unknown) as (
    props: ThunkProps
  ) => null;

  export const Raw = (MACHINAT_RAW_TYPE as unknown) as (
    props: RawProps
  ) => null;

  export const Bot = BaseBot;
  export const Profiler = BaseProfiler;
  export const Marshaler = BaseMarshaler;
}

export default Machinat;

declare global {
  namespace JSX {
    type Element = MachinatElement<any, any>;
    type ElementClass = NativeComponent<any, any> | ContainerComponent<any>;

    interface ElementAttributesProperty {
      $$typeof: {};
    }
    interface ElementChildrenAttribute {
      children: {};
    }

    type LibraryManagedAttributes<C, P> = C extends NativeComponent<
      infer T,
      any
    >
      ? T
      : C extends ContainerComponent<infer U>
      ? U
      : P;

    // interface IntrinsicElements {}
  }
}

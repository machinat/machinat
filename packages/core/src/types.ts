/* eslint-disable @typescript-eslint/no-use-before-define */
import type { InnerRenderFn, IntermediateSegment } from './renderer/types';
import type {
  Interfaceable,
  ServiceProvision,
  ServiceContainer,
  ServiceInterface,
  ServiceScope,
  MaybeContainer,
} from './service';
import type { DispatchFrame, DispatchResponse } from './engine/types';
import type {
  MACHINAT_ELEMENT_TYPE,
  MACHINAT_NATIVE_TYPE,
  MACHINAT_FRAGMENT_TYPE,
  MACHINAT_PAUSE_TYPE,
  MACHINAT_INJECTION_TYPE,
  MACHINAT_THUNK_TYPE,
  MACHINAT_RAW_TYPE,
} from './symbol';

export type { default as MachinatApp } from './app';
export type { MachinatProfile } from './base/Profiler';

export type MachinatRenderable =
  | MachinatText
  | GeneralElement
  | PauseElement
  | InjectionElement
  | RawElement
  | ThunkElement
  | FunctionalElement<unknown, any>
  | ContainerElement<unknown, any>;

export type MachinatNode =
  | MachinatEmpty
  | MachinatRenderable
  | ThunkElement
  | Array<MachinatNode>;

export type MachinatElementType =
  | string
  | FunctionalComponent<unknown>
  | ContainerComponent<unknown>
  | NativeComponent<unknown, any>
  | typeof MACHINAT_FRAGMENT_TYPE
  | typeof MACHINAT_PAUSE_TYPE
  | typeof MACHINAT_INJECTION_TYPE
  | typeof MACHINAT_THUNK_TYPE
  | typeof MACHINAT_RAW_TYPE;

export type MachinatElement<P, T> = {
  $$typeof: typeof MACHINAT_ELEMENT_TYPE;
  type: T;
  props: P;
};

export type MachinatText = string | number;
export type MachinatEmpty = null | undefined | boolean;

export type GeneralElement = MachinatElement<{ [key: string]: any }, string>;

type RenderCircs = {
  platform: string;
};

export type FunctionalComponent<Props> = (
  props: Props,
  circs: RenderCircs
) => MachinatNode | Promise<MachinatNode>;

export type FunctionalElement<
  Props,
  Component extends FunctionalComponent<Props>
> = MachinatElement<Props, Component>;

export type ContainerComponent<Props> = ServiceContainer<
  FunctionalComponent<Props>,
  unknown[]
>;

export type ContainerElement<
  Props,
  Component extends ContainerComponent<Props>
> = MachinatElement<Props, Component>;

export type NativeComponent<
  Props,
  Segment extends IntermediateSegment<unknown>
> = {
  (
    element: NativeElement<Props, NativeComponent<Props, Segment>>,
    path: string,
    render: InnerRenderFn<any>
  ): null | Segment[] | Promise<null | Segment[]>;
  $$typeof: typeof MACHINAT_NATIVE_TYPE;
  $$platform: string;
  // HACK: make ts accept it as class component
  new (): NativeComponent<Props, Segment>;
};

export type NativeElement<
  Props,
  Component extends NativeComponent<Props, any>
> = MachinatElement<Props, Component>;

export type FragmentProps = { children: MachinatNode };
export type FragmentElement = MachinatElement<
  FragmentProps,
  typeof MACHINAT_FRAGMENT_TYPE
>;

export type InjectionProps = {
  provide: Interfaceable<unknown>;
  value: unknown;
  children: MachinatNode;
};

export type InjectionElement = MachinatElement<
  InjectionProps,
  typeof MACHINAT_INJECTION_TYPE
>;

export type PauseDelayFn = () => Promise<unknown>;
export type PauseProps = { time?: number; delay?: PauseDelayFn };
export type PauseElement = MachinatElement<
  PauseProps,
  typeof MACHINAT_PAUSE_TYPE
>;

export type ThunkEffectFn = () => unknown | Promise<unknown>;
export type ThunkProps = { effect: ThunkEffectFn };
export type ThunkElement = MachinatElement<
  ThunkProps,
  typeof MACHINAT_THUNK_TYPE
>;

export type RawProps = { value: unknown };
export type RawElement = MachinatElement<RawProps, typeof MACHINAT_RAW_TYPE>;

export interface MachinatChannel {
  readonly platform: string;
  readonly uid: string;
}

export interface MachinatUser {
  readonly platform: string;
  readonly uid: string;
}

export interface MachinatEvent<Payload> {
  readonly platform: string;
  readonly category: string;
  readonly type: string;
  readonly payload: Payload;
  readonly channel: null | MachinatChannel;
  readonly user: null | MachinatUser;
}

export interface TextMessageMixin {
  readonly category: 'message';
  readonly type: 'text';
  readonly text: string;
}

export interface MediaMessageMixin {
  readonly category: 'message';
  readonly type: 'image' | 'video' | 'audio' | 'file';
  readonly url?: string;
}

export interface LocationMessageMixin {
  readonly category: 'message';
  readonly type: 'location';
  readonly latitude: number;
  readonly longitude: number;
}

export interface PostbackMixin {
  readonly category: 'postback';
  readonly type: string;
  readonly data: string;
}

export interface MachinatMetadata {
  source: string;
}

export interface MachinatBot<Channel extends MachinatChannel, Job, Result> {
  render(
    channel: Channel,
    message: MachinatNode
  ): Promise<null | DispatchResponse<Job, Result>>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export type EventContext<
  Event extends MachinatEvent<unknown>,
  Metadata extends MachinatMetadata,
  Bot extends MachinatBot<MachinatChannel, unknown, unknown>
> = {
  platform: string;
  event: Event;
  metadata: Metadata;
  bot: Bot;
  reply(message: MachinatNode): ReturnType<Bot['render']>;
};

export type AnyEventContext = EventContext<any, any, any>;

export type Middleware<Input, Output> = (
  input: Input,
  next: (input: Input) => Promise<Output>
) => Promise<Output>;

export type EventMiddleware<
  Context extends AnyEventContext,
  Response
> = Middleware<Context, Response>;

export type DispatchMiddleware<
  Job,
  Frame extends DispatchFrame<MachinatChannel, Job>,
  Result
> = Middleware<Frame, DispatchResponse<Job, Result>>;

export type ServiceModule = {
  provisions: ServiceProvision<unknown>[];
  startHook?: null | ServiceContainer<Promise<void>, unknown[]>;
  stopHook?: null | ServiceContainer<Promise<void>, unknown[]>;
};

export type MachinatPlatform<
  Context extends AnyEventContext,
  EventResp,
  Job,
  Frame extends DispatchFrame<MachinatChannel, Job>,
  Result
> = {
  name: string;
  utilitiesInterface: ServiceInterface<
    PlatformUtilities<Context, EventResp, Job, Frame, Result>
  >;
  provisions: ServiceProvision<unknown>[];
  startHook?: ServiceContainer<Promise<void>, unknown[]>;
  stopHook?: null | ServiceContainer<Promise<void>, unknown[]>;
  eventMiddlewares?: MaybeContainer<EventMiddleware<Context, EventResp>>[];
  dispatchMiddlewares?: MaybeContainer<
    DispatchMiddleware<Job, Frame, Result>
  >[];
};

export type AnyMachinatPlatform = MachinatPlatform<
  any,
  unknown,
  unknown,
  any,
  unknown
>;

export type AppConfig<Platform extends AnyMachinatPlatform> = {
  platforms?: Platform[];
  modules?: ServiceModule[];
  services?: ServiceProvision<unknown>[];
};

export type EventContextOfPlatform<Platform extends AnyMachinatPlatform> =
  Platform extends MachinatPlatform<
    infer Context,
    unknown,
    unknown,
    any,
    unknown
  >
    ? Context
    : never;

export type InitScopeFn = () => ServiceScope;

export type PopEventFn<Context extends AnyEventContext, Response> = (
  context: Context,
  scope?: ServiceScope
) => Promise<Response>;

export type PopEventWrapper<Context extends AnyEventContext, Response> = (
  finalHandler: (ctx: Context) => Promise<Response>
) => PopEventFn<Context, Response>;

export type PopErrorFn = (err: Error, scope?: ServiceScope) => void;

export type DispatchFn<
  Job,
  Frame extends DispatchFrame<MachinatChannel, Job>,
  Result
> = (
  frame: Frame,
  scope?: ServiceScope
) => Promise<DispatchResponse<Job, Result>>;

export type DispatchWrapper<
  Job,
  Frame extends DispatchFrame<MachinatChannel, Job>,
  Result
> = (
  dispatch: (frame: Frame) => Promise<DispatchResponse<Job, Result>>
) => DispatchFn<Job, Frame, Result>;

export type ModuleUtilities = {
  initScope: InitScopeFn;
  popError: PopErrorFn;
};

export type PlatformUtilities<
  Context extends AnyEventContext,
  EventResponse,
  Job,
  Frame extends DispatchFrame<MachinatChannel, Job>,
  Result
> = {
  popEventWrapper: PopEventWrapper<Context, EventResponse>;
  dispatchWrapper: DispatchWrapper<Job, Frame, Result>;
};

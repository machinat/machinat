import EventEmitter from 'events';
import moxy from 'moxy';
import Bot from '../bot';

const receiver = moxy({
  bind: () => true,
  unbined: () => true,
});

const controller = moxy({
  setMiddlewares: () => controller,
  setFramePrototype: () => controller,
  makeEventHandler: () => () => {},
});

const engine = moxy({
  queue: {},
  setMiddlewares: () => engine,
  setFramePrototype: () => engine,
  dispatch: () => 'Vrooooooooooooooom',
});

const worker = moxy({
  start: () => true,
  stop: () => true,
});

beforeEach(() => {
  receiver.mock.clear();
  controller.mock.clear();
  engine.mock.clear();
  worker.mock.clear();
});

it('extends EventEmitter', () => {
  expect(new Bot(receiver, controller, engine, worker)).toBeInstanceOf(
    EventEmitter
  );
});

describe('#constructor(controller, engine, worker, plugins)', () => {
  it('initiats with controller and engine', () => {
    const bot = new Bot(receiver, controller, engine, worker);

    expect(bot.receiver).toBe(receiver);
    expect(bot.controller).toBe(controller);
    expect(bot.engine).toBe(engine);
    expect(bot.worker).toBe(worker);
  });

  it('starts worker', () => {
    const bot = new Bot(receiver, controller, engine, worker);

    expect(bot.worker.start.mock).toHaveBeenCalledTimes(1);
    expect(bot.worker.start.mock).toHaveBeenCalledWith(engine.queue);
  });

  it('setFramePrototype() with "bot" prop of engine and controller', () => {
    const bot = new Bot(receiver, controller, engine, worker);

    expect(engine.setFramePrototype.mock).toHaveBeenCalledWith({ bot });
    expect(controller.setFramePrototype.mock).toHaveBeenCalledWith({ bot });
  });

  it('calls controller.makeEventHandler() with events firing callback', () => {
    const bot = new Bot(receiver, controller, engine, worker);

    const onEvent = controller.makeEventHandler.mock.calls[0].args[0];

    expect(typeof onEvent).toBe('function');

    const eventListener = moxy();
    bot.on('event', eventListener);
    const receiveFrame = { foo: 'bar' };
    onEvent(receiveFrame);
    expect(eventListener.mock).toHaveBeenCalledWith(receiveFrame);
  });

  it('calls receiver.bind() with eventHandler and errorHandler', () => {
    const bot = new Bot(receiver, controller, engine, worker);

    expect(receiver.bind.mock).toHaveBeenCalledTimes(1);
    expect(receiver.bind.mock.calls[0].args[0]).toBe(
      controller.makeEventHandler.mock.calls[0].result
    );

    const onError = receiver.bind.mock.calls[0].args[1];

    const errorListener = moxy();
    bot.on('error', errorListener);
    const error = new Error('boom');
    onError(error);
    expect(errorListener.mock).toHaveBeenCalledWith(error, bot);
  });

  it('setups controller and engine with middlewares and extenstion from plugins', () => {
    const rmw1 = () => () => {};
    const rmw2 = () => () => {};
    const smw1 = () => () => {};
    const smw2 = () => () => {};
    const plugins = [
      moxy(() => ({
        dispatchMiddleware: smw1,
        eventFrameExtension: { foo: 1 },
      })),
      moxy(() => ({
        eventMiddleware: rmw1,
        dispatchFrameExtension: { foo: 2 },
      })),
      moxy(() => ({
        dispatchMiddleware: smw2,
        eventMiddleware: rmw2,
        dispatchFrameExtension: { bar: 1 },
        eventFrameExtension: { bar: 2 },
      })),
    ];

    const bot = new Bot(receiver, controller, engine, worker, plugins);

    plugins.forEach(pluginFn => {
      expect(pluginFn.mock).toHaveBeenCalledTimes(1);
      expect(pluginFn.mock).toHaveBeenCalledWith(bot);
    });

    expect(controller.setMiddlewares.mock).toHaveBeenCalledWith(rmw1, rmw2);
    expect(engine.setMiddlewares.mock).toHaveBeenCalledWith(smw1, smw2);

    expect(engine.setFramePrototype.mock).toHaveBeenCalledWith({
      bot,
      foo: 2,
      bar: 1,
    });
    expect(controller.setFramePrototype.mock).toHaveBeenCalledWith({
      bot,
      foo: 1,
      bar: 2,
    });
  });
});

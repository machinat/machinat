import moxy from '@moxyjs/moxy';
import { makeContainer, ServiceScope } from '@machinat/core/service';
import execute from '../execute';

const delay = (t) => new Promise((resolve) => setTimeout(resolve, t));

const scope: ServiceScope = moxy<ServiceScope>({
  injectContainer(containerFn) {
    return containerFn('FOO_SERVICE');
  },
} as never);

const channel = { platform: 'test', uid: '_MY_CHANNEL_' };

const mockScript = (commands, stopPointIndex?, name?, initVars?) =>
  moxy<any>(
    {
      name: name || 'MockScript',
      commands,
      stopPointIndex: stopPointIndex || new Map(),
      initVars: initVars || ((input) => input || {}),
    } as never,
    { includeProperties: ['*'], excludeProperties: ['stopPointIndex'] }
  );

describe('executing content command', () => {
  test('with sync getContent function', async () => {
    const contentCommand = {
      type: 'content',
      getContent: moxy(() => 'hello world'),
    };
    await expect(
      execute(
        scope,
        channel,
        [
          {
            script: mockScript([contentCommand]),
            vars: { foo: 'bar' },
            stopAt: undefined,
          },
        ],
        true
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['hello world'],
      stack: null,
    });
    expect(contentCommand.getContent.mock).toHaveBeenCalledTimes(1);
    expect(contentCommand.getContent.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'bar' },
    });

    const contentCommand1 = {
      type: 'content',
      getContent: moxy(() => 'hello'),
    };
    const contentCommand2 = {
      type: 'content',
      getContent: moxy(() => 'world'),
    };
    await expect(
      execute(
        scope,
        channel,
        [
          {
            script: mockScript([contentCommand1, contentCommand2]),
            vars: { foo: 'baz' },
            stopAt: undefined,
          },
        ],
        true
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['hello', 'world'],
      stack: null,
    });
    expect(contentCommand1.getContent.mock).toHaveBeenCalledTimes(1);
    expect(contentCommand1.getContent.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'baz' },
    });
    expect(contentCommand2.getContent.mock).toHaveBeenCalledTimes(1);
    expect(contentCommand2.getContent.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'baz' },
    });
  });

  test('with async getContent function', async () => {
    const commands = moxy(
      [
        { type: 'content', getContent: () => 'hello' },
        {
          type: 'content',
          getContent: async () => {
            await delay(10);
            return 'it is an';
          },
        },
        { type: 'content', getContent: async () => 'async' },
        { type: 'content', getContent: () => 'world' },
      ] as any,
      { includeProperties: ['*'] }
    );

    await expect(
      execute(
        scope,
        channel,
        [
          {
            script: mockScript(commands),
            vars: { foo: 'bar' },
            stopAt: undefined,
          },
        ],
        true
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['hello', 'it is an', 'async', 'world'],
      stack: null,
    });
    for (const { getContent } of commands) {
      expect(getContent.mock).toHaveBeenCalledTimes(1);
      expect(getContent.mock).toHaveBeenCalledWith({
        platform: 'test',
        channel,
        vars: { foo: 'bar' },
      });
    }
  });

  test('with async getContent container', async () => {
    const getContent = moxy(async () => 'a contained');
    const getContentContainer = moxy(
      makeContainer({ deps: [] })(() => getContent)
    );

    await expect(
      execute(
        scope,
        channel,
        [
          {
            script: mockScript([
              { type: 'content', getContent: async () => 'hello' },
              { type: 'content', getContent: getContentContainer },
              { type: 'content', getContent: () => 'world' },
            ]),
            vars: { foo: 'bar' },
            stopAt: undefined,
          },
        ],
        true
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['hello', 'a contained', 'world'],
      stack: null,
    });
    expect(getContent.mock).toHaveBeenCalledTimes(1);
    expect(getContent.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'bar' },
    });
    expect(getContentContainer.mock).toHaveBeenCalledTimes(1);
    expect(getContentContainer.mock).toHaveBeenCalledWith('FOO_SERVICE');
  });
});

describe('executing prompt command', () => {
  const promptCommand = moxy({
    type: 'prompt',
    setVars: ({ vars }, { answer }) => ({ ...vars, answer }),
    key: 'prompt#0',
  });

  const script = mockScript(
    [
      { type: 'content', getContent: () => 'foo' },
      promptCommand,
      { type: 'content', getContent: ({ vars: { answer } }) => answer },
    ],
    new Map([['prompt#0', 1]])
  );

  beforeEach(() => {
    promptCommand.mock.reset();
    script.mock.reset();
  });

  test('stop when a prompt command is met', async () => {
    await expect(
      execute(
        scope,
        channel,
        [{ script, vars: { foo: 'bar' }, stopAt: undefined }],
        true
      )
    ).resolves.toEqual({
      finished: false,
      returnedValue: undefined,
      contents: ['foo'],
      stack: [{ script, vars: { foo: 'bar' }, stopAt: 'prompt#0' }],
    });

    expect(promptCommand.setVars.mock).not.toHaveBeenCalled();
  });

  test('yield value when prompting', async () => {
    promptCommand.mock
      .getter('yieldValue')
      .fakeReturnValue(() => 'hello from prompt');

    await expect(
      execute(
        scope,
        channel,
        [{ script, vars: { foo: 'bar' }, stopAt: undefined }],
        true
      )
    ).resolves.toEqual({
      finished: false,
      returnedValue: undefined,
      yieldedValue: 'hello from prompt',
      contents: ['foo'],
      stack: [{ script, vars: { foo: 'bar' }, stopAt: 'prompt#0' }],
    });

    expect(promptCommand.setVars.mock).not.toHaveBeenCalled();
  });

  test('continue from prompt point', async () => {
    await expect(
      execute(
        scope,
        channel,
        [{ script, vars: { foo: 'bar' }, stopAt: 'prompt#0' }],
        false,
        { answer: 'yes' }
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['yes'],
      stack: null,
    });

    expect(promptCommand.setVars.mock).toHaveBeenCalledTimes(1);
    expect(promptCommand.setVars.mock).toHaveBeenCalledWith(
      { platform: 'test', channel, vars: { foo: 'bar' } },
      { answer: 'yes' }
    );
    expect(script.commands[2].getContent.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'bar', answer: 'yes' },
    });
  });

  test('continue with async setVars', async () => {
    promptCommand.setVars.mock.fake(async ({ vars }, { answer }) => ({
      ...vars,
      answer,
    }));

    await expect(
      execute(
        scope,
        channel,
        [{ script, vars: { foo: 'bar' }, stopAt: 'prompt#0' }],
        false,
        { answer: 'no' }
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['no'],
      stack: null,
    });

    expect(promptCommand.setVars.mock).toHaveBeenCalledTimes(1);
    expect(promptCommand.setVars.mock).toHaveBeenCalledWith(
      { platform: 'test', channel, vars: { foo: 'bar' } },
      { answer: 'no' }
    );
    expect(script.commands[2].getContent.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'bar', answer: 'no' },
    });
  });

  test('continue with async container setVars', async () => {
    const setVars = moxy(async ({ vars }, { answer }) => ({ ...vars, answer }));
    const setVarsContainer = moxy(makeContainer({ deps: [] })(() => setVars));
    promptCommand.mock.getter('setVars').fake(() => setVarsContainer);

    await expect(
      execute(
        scope,
        channel,
        [{ script, vars: { foo: 'bar' }, stopAt: 'prompt#0' }],
        false,
        { answer: 'maybe' }
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['maybe'],
      stack: null,
    });

    expect(setVarsContainer.mock).toHaveBeenCalledTimes(1);
    expect(setVarsContainer.mock).toHaveBeenCalledWith('FOO_SERVICE');

    expect(setVars.mock).toHaveBeenCalledTimes(1);
    expect(setVars.mock).toHaveBeenCalledWith(
      { platform: 'test', channel, vars: { foo: 'bar' } },
      { answer: 'maybe' }
    );
    expect(script.commands[2].getContent.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'bar', answer: 'maybe' },
    });
  });
});

describe('executing call command', () => {
  test('call script with no data transfer', async () => {
    const subScript = mockScript(
      [{ type: 'content', getContent: moxy(() => 'at skyfall') }],
      new Map(),
      'ChildScript'
    );
    const script = mockScript([
      { type: 'call', script: subScript },
      { type: 'content', getContent: () => 'aww~awwww~awwwwwwwwww~' },
    ]);

    await expect(
      execute(
        scope,
        channel,
        [{ script, vars: { foo: 'bar' }, stopAt: undefined }],
        true
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['at skyfall', 'aww~awwww~awwwwwwwwww~'],
      stack: null,
    });
    expect(subScript.commands[0].getContent.mock).toHaveBeenCalledTimes(1);
    expect(subScript.commands[0].getContent.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: {},
    });
    expect(script.commands[1].getContent.mock).toHaveBeenCalledTimes(1);
    expect(script.commands[1].getContent.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'bar' },
    });
  });

  describe('call script with vars and setVars', () => {
    const subScript = mockScript(
      [
        { type: 'content', getContent: () => 'hello the other side' },
        { type: 'return', getValue: () => ({ hello: 'from bottom' }) },
      ],
      null,
      'ChildScript'
    );
    const callCommand = moxy({
      type: 'call',
      script: subScript,
      withParams: () => ({ hello: 'from top' }),
      setVars: ({ vars }, returnedValue) => ({ ...vars, ...returnedValue }),
    });
    const script = mockScript([
      callCommand,
      { type: 'content', getContent: () => 'yaaaaaay' },
    ]);

    beforeEach(() => {
      callCommand.mock.reset();
      subScript.mock.reset();
      script.mock.reset();
    });

    test('with sync vars function', async () => {
      await expect(
        execute(
          scope,
          channel,
          [{ script, vars: { foo: 'bar' }, stopAt: undefined }],
          true
        )
      ).resolves.toEqual({
        finished: true,
        returnedValue: undefined,
        contents: ['hello the other side', 'yaaaaaay'],
        stack: null,
      });
      expect(subScript.commands[1].getValue.mock).toHaveBeenCalledTimes(1);
      expect(subScript.commands[1].getValue.mock).toHaveBeenCalledWith({
        platform: 'test',
        channel,
        vars: { hello: 'from top' },
      });
      expect(script.commands[0].withParams.mock).toHaveBeenCalledTimes(1);
      expect(script.commands[0].withParams.mock).toHaveBeenCalledWith({
        platform: 'test',
        channel,
        vars: { foo: 'bar' },
      });
      expect(script.commands[0].setVars.mock).toHaveBeenCalledTimes(1);
      expect(script.commands[0].setVars.mock).toHaveBeenCalledWith(
        { platform: 'test', channel, vars: { foo: 'bar' } },
        { hello: 'from bottom' }
      );
      expect(script.commands[1].getContent.mock).toHaveBeenCalledTimes(1);
      expect(script.commands[1].getContent.mock).toHaveBeenCalledWith({
        platform: 'test',
        channel,
        vars: { foo: 'bar', hello: 'from bottom' },
      });
    });

    test('with async vars functions', async () => {
      callCommand.withParams.mock.fake(async () => ({
        hello: 'async from top',
      }));
      callCommand.setVars.mock.fake(async ({ vars }, returnedValue) => ({
        ...vars,
        ...returnedValue,
      }));

      await expect(
        execute(
          scope,
          channel,
          [{ script, vars: { foo: 'bar' }, stopAt: undefined }],
          true
        )
      ).resolves.toEqual({
        finished: true,
        returnedValue: undefined,
        contents: ['hello the other side', 'yaaaaaay'],
        stack: null,
      });
      expect(subScript.commands[1].getValue.mock).toHaveBeenCalledTimes(1);
      expect(subScript.commands[1].getValue.mock).toHaveBeenCalledWith({
        platform: 'test',
        channel,
        vars: { hello: 'async from top' },
      });
      expect(script.commands[0].withParams.mock).toHaveBeenCalledTimes(1);
      expect(script.commands[0].withParams.mock).toHaveBeenCalledWith({
        platform: 'test',
        channel,
        vars: { foo: 'bar' },
      });
      expect(script.commands[0].setVars.mock).toHaveBeenCalledTimes(1);
      expect(script.commands[0].setVars.mock).toHaveBeenCalledWith(
        { platform: 'test', channel, vars: { foo: 'bar' } },
        { hello: 'from bottom' }
      );
    });

    test('with container vars functions', async () => {
      const withParamsFn = moxy(async () => ({ hello: 'from top container' }));
      const withParamsContainer = moxy(
        makeContainer({ deps: [] })(() => withParamsFn)
      );
      const setVarsFn = moxy(async ({ vars }, returnedValue) => ({
        ...vars,
        ...returnedValue,
      }));
      const setVarsContainer = moxy(
        makeContainer({ deps: [] })(() => setVarsFn)
      );

      callCommand.mock.getter('setVars').fake(() => setVarsContainer);
      callCommand.mock.getter('withParams').fake(() => withParamsContainer);

      await expect(
        execute(
          scope,
          channel,
          [{ script, vars: { foo: 'bar' }, stopAt: undefined }],
          true
        )
      ).resolves.toEqual({
        finished: true,
        returnedValue: undefined,
        contents: ['hello the other side', 'yaaaaaay'],
        stack: null,
      });
      expect(subScript.commands[1].getValue.mock).toHaveBeenCalledTimes(1);
      expect(subScript.commands[1].getValue.mock).toHaveBeenCalledWith({
        platform: 'test',
        channel,
        vars: { hello: 'from top container' },
      });
      expect(withParamsContainer.mock).toHaveBeenCalledTimes(1);
      expect(withParamsContainer.mock).toHaveBeenCalledWith('FOO_SERVICE');
      expect(withParamsFn.mock).toHaveBeenCalledTimes(1);
      expect(withParamsFn.mock).toHaveBeenCalledWith({
        platform: 'test',
        channel,
        vars: { foo: 'bar' },
      });
      expect(setVarsContainer.mock).toHaveBeenCalledTimes(1);
      expect(setVarsContainer.mock).toHaveBeenCalledWith('FOO_SERVICE');
      expect(setVarsFn.mock).toHaveBeenCalledTimes(1);
      expect(setVarsFn.mock).toHaveBeenCalledWith(
        { platform: 'test', channel, vars: { foo: 'bar' } },
        { hello: 'from bottom' }
      );
    });
  });

  test('when prompt in subscript met', async () => {
    const subScript = mockScript(
      [
        { type: 'content', getContent: () => "i can't go back" },
        { type: 'prompt', key: 'childPrompt' },
      ],
      new Map(),
      'ChildScript'
    );
    const script = mockScript([
      {
        type: 'call',
        script: subScript,
        withParams: () => ({ foo: 'baz' }),
        key: 'motherCall',
      },
      { type: 'content', getContent: () => 'to River Rea' },
    ]);

    await expect(
      execute(
        scope,
        channel,
        [{ script, vars: { foo: 'bar' }, stopAt: undefined }],
        true
      )
    ).resolves.toEqual({
      finished: false,
      returnedValue: undefined,
      contents: ["i can't go back"],
      stack: [
        { script, vars: { foo: 'bar' }, stopAt: 'motherCall' },
        { script: subScript, vars: { foo: 'baz' }, stopAt: 'childPrompt' },
      ],
    });
    expect(subScript.commands[0].getContent.mock).toHaveBeenCalledTimes(1);
    expect(subScript.commands[0].getContent.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'baz' },
    });
    expect(script.commands[1].getContent.mock).not.toHaveBeenCalled();
  });

  test('call script with goto', async () => {
    const subScript = mockScript(
      [
        { type: 'content', getContent: moxy(() => 'there is a fire') },
        { type: 'content', getContent: moxy(() => 'starting in my heart') },
      ],
      new Map([['where', 1]]),
      'ChildScript'
    );

    await expect(
      execute(
        scope,
        channel,
        [
          {
            script: mockScript([
              { type: 'call', script: subScript, goto: 'where' },
            ]),
            vars: { foo: 'bar' },
            stopAt: undefined,
          },
        ],
        true
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['starting in my heart'],
      stack: null,
    });
    expect(subScript.commands[0].getContent.mock).not.toHaveBeenCalled();
    expect(subScript.commands[1].getContent.mock).toHaveBeenCalledTimes(1);
    expect(subScript.commands[1].getContent.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: {},
    });
  });
});

describe('executing jump command', () => {
  test('jump', async () => {
    const script = mockScript([
      { type: 'content', getContent: () => 'foo' },
      { type: 'jump', offset: 2 },
      { type: 'content', getContent: () => 'bar' },
      { type: 'content', getContent: () => 'baz' },
    ]);
    await expect(
      execute(scope, channel, [{ script, vars: {}, stopAt: undefined }], true)
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['foo', 'baz'],
      stack: null,
    });
    expect(script.commands[2].getContent.mock).not.toHaveBeenCalled();
  });

  test('run jump command to overflow index', async () => {
    const script = mockScript([
      { type: 'content', getContent: () => 'foo' },
      { type: 'jump', offset: 2 },
      { type: 'content', getContent: () => 'bar' },
    ]);
    await expect(
      execute(scope, channel, [{ script, vars: {}, stopAt: undefined }], true)
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['foo'],
      stack: null,
    });
    expect(script.commands[2].getContent.mock).not.toHaveBeenCalled();
  });
});

describe('executing jump_condition command', () => {
  const jumpCondCommand = moxy({
    type: 'jump_cond',
    condition: () => true,
    isNot: false,
    offset: 2,
  });
  const script = mockScript([
    { type: 'content', getContent: () => 'foo' },
    jumpCondCommand,
    { type: 'content', getContent: () => 'bar' },
    { type: 'content', getContent: () => 'baz' },
  ]);

  beforeEach(() => {
    jumpCondCommand.mock.reset();
    script.mock.reset();
  });

  test('with sync condition function', async () => {
    await expect(
      execute(scope, channel, [{ script, vars: {}, stopAt: undefined }], true)
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['foo', 'baz'],
      stack: null,
    });
    expect(script.commands[2].getContent.mock).not.toHaveBeenCalled();

    jumpCondCommand.condition.mock.fakeReturnValue(false);
    await expect(
      execute(scope, channel, [{ script, vars: {}, stopAt: undefined }], true)
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['foo', 'bar', 'baz'],
      stack: null,
    });
    expect(script.commands[2].getContent.mock).toHaveBeenCalledTimes(1);
  });

  test('with async condition function', async () => {
    jumpCondCommand.condition.mock.fake(async () => true);
    await expect(
      execute(scope, channel, [{ script, vars: {}, stopAt: undefined }], true)
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['foo', 'baz'],
      stack: null,
    });

    jumpCondCommand.condition.mock.fake(async () => false);
    await expect(
      execute(scope, channel, [{ script, vars: {}, stopAt: undefined }], true)
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['foo', 'bar', 'baz'],
      stack: null,
    });
  });

  test('with async condition container', async () => {
    const conditionFn = moxy(async () => true);
    const conditionContainer = moxy(
      makeContainer({ deps: [] })(() => conditionFn)
    );

    jumpCondCommand.mock.getter('condition').fake(() => conditionContainer);
    await expect(
      execute(scope, channel, [{ script, vars: {}, stopAt: undefined }], true)
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['foo', 'baz'],
      stack: null,
    });

    conditionFn.mock.fake(async () => false);
    await expect(
      execute(scope, channel, [{ script, vars: {}, stopAt: undefined }], true)
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['foo', 'bar', 'baz'],
      stack: null,
    });
  });

  test('run jump_cond command with isNot set to true', async () => {
    jumpCondCommand.mock.getter('isNot').fakeReturnValue(true);

    await expect(
      execute(scope, channel, [{ script, vars: {}, stopAt: undefined }], true)
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['foo', 'bar', 'baz'],
      stack: null,
    });
    expect(script.commands[2].getContent.mock).toHaveBeenCalledTimes(1);

    script.commands[1].condition.mock.fakeReturnValue(false);
    await expect(
      execute(scope, channel, [{ script, vars: {}, stopAt: undefined }], true)
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['foo', 'baz'],
      stack: null,
    });
    expect(script.commands[2].getContent.mock).toHaveBeenCalledTimes(1);
  });
});

describe('executing return command', () => {
  test('return immediatly if return command met', async () => {
    const script = mockScript([
      { type: 'content', getContent: () => 'hello' },
      { type: 'return' },
      { type: 'content', getContent: () => 'world' },
    ]);
    await expect(
      execute(
        scope,
        channel,
        [{ script, vars: { foo: 'bar' }, stopAt: undefined }],
        true
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: undefined,
      contents: ['hello'],
      stack: null,
    });
    expect(script.commands[2].getContent.mock).not.toHaveBeenCalled();
  });

  const returnCommand = moxy({
    type: 'return',
    getValue: ({ vars }) => vars.foo,
  });

  const script = mockScript([
    { type: 'content', getContent: () => 'hello' },
    returnCommand,
  ]);

  beforeEach(() => {
    returnCommand.mock.reset();
    script.mock.reset();
  });

  test('return with sync getValue function', async () => {
    await expect(
      execute(
        scope,
        channel,
        [{ script, vars: { foo: 'bar' }, stopAt: undefined }],
        true
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: 'bar',
      contents: ['hello'],
      stack: null,
    });

    expect(returnCommand.getValue.mock).toHaveBeenCalledTimes(1);
    expect(returnCommand.getValue.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'bar' },
    });
  });

  test('return with async getValue function', async () => {
    returnCommand.getValue.mock.fake(async ({ vars }) => vars.foo);
    await expect(
      execute(
        scope,
        channel,
        [{ script, vars: { foo: 'bar' }, stopAt: undefined }],
        true
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: 'bar',
      contents: ['hello'],
      stack: null,
    });
    expect(returnCommand.getValue.mock).toHaveBeenCalledTimes(1);
    expect(returnCommand.getValue.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'bar' },
    });
  });

  test('return with async getValue container', async () => {
    const valueFn = moxy(async ({ vars }) => vars.foo);
    const valueContainer = moxy(makeContainer({ deps: [] })(() => valueFn));
    returnCommand.mock.getter('getValue').fake(() => valueContainer);

    await expect(
      execute(
        scope,
        channel,
        [{ script, vars: { foo: 'bar' }, stopAt: undefined }],
        true
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: 'bar',
      contents: ['hello'],
      stack: null,
    });
    expect(valueContainer.mock).toHaveBeenCalledTimes(1);
    expect(valueContainer.mock).toHaveBeenCalledWith('FOO_SERVICE');

    expect(valueFn.mock).toHaveBeenCalledTimes(1);
    expect(valueFn.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'bar' },
    });
  });
});

describe('executing effect command', () => {
  const effectCommand = moxy({
    type: 'effect',
    doEffect: async () => 'baz',
    setVars: (_, result) => ({ foo: result }),
  });

  const script = mockScript([
    effectCommand,
    { type: 'content', getContent: () => 'hello' },
    { type: 'return', getValue: ({ vars }) => vars },
  ]);

  beforeEach(() => {
    effectCommand.mock.reset();
    script.mock.reset();
  });

  test('execute doEffect the setVars', async () => {
    const result = await execute(
      scope,
      channel,
      [{ script, vars: { foo: 'bar' }, stopAt: undefined }],
      true
    );

    expect(result).toEqual({
      finished: true,
      returnedValue: { foo: 'baz' },
      contents: ['hello'],
      stack: null,
    });

    expect(effectCommand.doEffect.mock).toHaveBeenCalledTimes(1);
    expect(effectCommand.doEffect.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'bar' },
    });

    expect(effectCommand.setVars.mock).toHaveBeenCalledTimes(1);
    expect(effectCommand.setVars.mock).toHaveBeenCalledWith(
      { platform: 'test', channel, vars: { foo: 'bar' } },
      'baz'
    );
  });

  test('without doEffect', async () => {
    effectCommand.mock.getter('doEffect').fakeReturnValue(undefined);
    effectCommand.setVars.mock.fakeReturnValue({ foo: 'bar' });

    const result = await execute(
      scope,
      channel,
      [{ script, vars: {}, stopAt: undefined }],
      true
    );

    expect(result).toEqual({
      finished: true,
      returnedValue: { foo: 'bar' },
      contents: ['hello'],
      stack: null,
    });

    expect(effectCommand.setVars.mock).toHaveBeenCalledTimes(1);
    expect(effectCommand.setVars.mock).toHaveBeenCalledWith(
      { platform: 'test', channel, vars: {} },
      undefined
    );
  });

  test('with async doEffect/setVars container', async () => {
    const effectFn = moxy(async () => 'baz');
    const effectContainer = moxy(makeContainer({ deps: [] })(() => effectFn));
    effectCommand.mock.getter('doEffect').fake(() => effectContainer);

    const setVarsFn = moxy(async (_, result) => ({ foo: result }));
    const setVarsContainer = moxy(makeContainer({ deps: [] })(() => setVarsFn));
    effectCommand.mock.getter('setVars').fake(() => setVarsContainer);

    await expect(
      execute(
        scope,
        channel,
        [{ script, vars: { foo: 'bar' }, stopAt: undefined }],
        true
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: { foo: 'baz' },
      contents: ['hello'],
      stack: null,
    });

    expect(effectContainer.mock).toHaveBeenCalledTimes(1);
    expect(effectContainer.mock).toHaveBeenCalledWith('FOO_SERVICE');

    expect(effectFn.mock).toHaveBeenCalledTimes(1);
    expect(effectFn.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'bar' },
    });

    expect(setVarsContainer.mock).toHaveBeenCalledTimes(1);
    expect(setVarsContainer.mock).toHaveBeenCalledWith('FOO_SERVICE');

    expect(setVarsFn.mock).toHaveBeenCalledTimes(1);
    expect(setVarsFn.mock).toHaveBeenCalledWith(
      { platform: 'test', channel, vars: { foo: 'bar' } },
      'baz'
    );
  });
});

describe('run whole script', () => {
  const ChildScript = mockScript(
    [
      { type: 'content', getContent: ({ vars: { desc } }) => desc },
      { type: 'jump_cond', condition: () => true, isNot: false, offset: 2 },
      {
        type: 'prompt',
        setVars: ({ vars }, input) => ({ ...vars, ...input }),
        key: 'CHILD_PROMPT',
      },
      { type: 'return', getValue: ({ vars }) => vars },
    ],
    new Map([
      ['BEGIN', 0],
      ['CHILD_PROMPT', 2],
    ]),
    'ChildScript'
  );

  const MockScript = mockScript(
    [
      { type: 'jump_cond', condition: () => false, isNot: false, offset: 3 },
      { type: 'content', getContent: () => 'hello' },
      { type: 'jump', offset: 3 },
      { type: 'content', getContent: () => 'bye' },
      { type: 'return', getValue: ({ vars }) => vars },
      { type: 'jump_cond', condition: () => true, isNot: true, offset: 5 },
      {
        type: 'effect',
        setVars: ({ vars }) => ({ ...vars, t: (vars.t || 0) + 1 }),
      },
      {
        type: 'prompt',
        setVars: ({ vars }, { desc }) => ({ ...vars, desc }),
        key: 'PROMPT',
      },
      {
        type: 'call',
        script: ChildScript,
        withParams: ({ vars: { desc } }) => ({ desc }),
        setVars: ({ vars }, returnedValue) => ({ ...vars, ...returnedValue }),
        goto: 'BEGIN',
        key: 'CALL',
      },
      { type: 'jump', offset: -4 },
      { type: 'content', getContent: () => 'world' },
      { type: 'return', getValue: ({ vars }) => vars },
    ],
    new Map([
      ['BEGIN', 0],
      ['PROMPT', 7],
      ['CALL', 8],
    ]),
    'MockScript',
    (input) => ({ ...input, t: 0 })
  );

  beforeEach(() => {
    MockScript.mock.reset();
    ChildScript.mock.reset();
  });

  test('start from begin', async () => {
    await expect(
      execute(
        scope,
        channel,
        [{ script: MockScript, vars: { foo: 'bar' }, stopAt: undefined }],
        true
      )
    ).resolves.toEqual({
      finished: false,
      returnedValue: undefined,
      stack: [
        {
          script: MockScript,
          vars: { foo: 'bar', t: 1 },
          stopAt: 'PROMPT',
        },
      ],
      contents: ['hello'],
    });

    const { commands } = MockScript;
    expect(commands[0].condition.mock).toHaveBeenCalledTimes(1);
    expect(commands[1].getContent.mock).toHaveBeenCalledTimes(1);
    expect(commands[1].getContent.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'bar' },
    });
    expect(commands[3].getContent.mock).not.toHaveBeenCalled();
    expect(commands[5].condition.mock).toHaveBeenCalledTimes(1);
    expect(commands[5].condition.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'bar' },
    });
    expect(commands[6].setVars.mock).toHaveBeenCalledTimes(1);
    expect(commands[6].setVars.mock).toHaveBeenCalledWith(
      { platform: 'test', channel, vars: { foo: 'bar' } },
      undefined
    );
    expect(commands[8].withParams.mock).not.toHaveBeenCalled();
    expect(commands[10].getContent.mock).not.toHaveBeenCalled();

    expect(MockScript.initVars.mock).not.toHaveBeenCalled();
  });

  test('return at middle', async () => {
    MockScript.commands[0].condition.mock.fakeReturnValue(true);
    await expect(
      execute(
        scope,
        channel,
        [{ script: MockScript, vars: { foo: 'bar' }, stopAt: undefined }],
        true
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: { foo: 'bar' },
      stack: null,
      contents: ['bye'],
    });

    const { commands } = MockScript;
    expect(commands[0].condition.mock).toHaveBeenCalledTimes(1);
    expect(commands[1].getContent.mock).not.toHaveBeenCalled();
    expect(commands[3].getContent.mock).toHaveBeenCalledTimes(1);
    expect(commands[3].getContent.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'bar' },
    });
    expect(commands[5].condition.mock).not.toHaveBeenCalled();
    expect(commands[6].setVars.mock).not.toHaveBeenCalled();
    expect(commands[8].withParams.mock).not.toHaveBeenCalled();
    expect(commands[10].getContent.mock).not.toHaveBeenCalled();
  });

  test('continue from prompt within the loops', async () => {
    let stack: any = [
      { script: MockScript, vars: { foo: 'bar' }, stopAt: 'PROMPT' },
    ];

    const descriptions = ['fun', 'beautyful', 'wonderful'];
    for (const [idx, word] of descriptions.entries()) {
      // eslint-disable-next-line no-await-in-loop
      const result = await execute(scope, channel, stack, false, {
        desc: word,
      });

      expect(result).toEqual({
        finished: false,
        returnedValue: undefined,
        stack: [
          {
            script: MockScript,
            vars: { foo: 'bar', desc: word, t: idx + 1 },
            stopAt: 'PROMPT',
          },
        ],
        contents: [word],
      });
      ({ stack } = result);
    }

    MockScript.commands[5].condition.mock.fakeReturnValue(false);
    await expect(
      execute(scope, channel, stack, false, { desc: 'fascinating' })
    ).resolves.toEqual({
      finished: true,
      returnedValue: { foo: 'bar', t: 3, desc: 'fascinating' },
      stack: null,
      contents: ['fascinating', 'world'],
    });

    expect(MockScript.initVars.mock).not.toHaveBeenCalled();

    const { commands } = MockScript;
    expect(commands[0].condition.mock).not.toHaveBeenCalled();
    expect(commands[1].getContent.mock).not.toHaveBeenCalled();
    expect(commands[3].getContent.mock).not.toHaveBeenCalled();
    expect(commands[5].condition.mock).toHaveBeenCalledTimes(4);
    expect(commands[6].setVars.mock).toHaveBeenCalledTimes(3);
    expect(commands[8].withParams.mock).toHaveBeenCalledTimes(4);
    expect(commands[10].getContent.mock).toHaveBeenCalledTimes(1);

    expect(ChildScript.commands[0].getContent.mock).toHaveBeenCalledTimes(4);
    expect(ChildScript.commands[1].condition.mock).toHaveBeenCalledTimes(4);

    expect(ChildScript.initVars.mock).toHaveBeenCalledTimes(4);
    expect(MockScript.initVars.mock).not.toHaveBeenCalled();
  });

  test('prompt in the subscript', async () => {
    ChildScript.commands[1].condition.mock.fakeReturnValue(false);
    await expect(
      execute(
        scope,
        channel,
        [{ script: MockScript, vars: { foo: 'bar' }, stopAt: 'PROMPT' }],
        false,
        { desc: 'fabulous' }
      )
    ).resolves.toEqual({
      finished: false,
      returnedValue: undefined,
      stack: [
        {
          script: MockScript,
          vars: { foo: 'bar', desc: 'fabulous' },
          stopAt: 'CALL',
        },
        {
          script: ChildScript,
          vars: { desc: 'fabulous' },
          stopAt: 'CHILD_PROMPT',
        },
      ],
      contents: ['fabulous'],
    });

    const { commands } = MockScript;
    expect(commands[0].condition.mock).not.toHaveBeenCalled();
    expect(commands[1].getContent.mock).not.toHaveBeenCalled();
    expect(commands[3].getContent.mock).not.toHaveBeenCalled();
    expect(commands[5].condition.mock).not.toHaveBeenCalled();
    expect(commands[6].setVars.mock).not.toHaveBeenCalled();
    expect(commands[8].withParams.mock).toHaveBeenCalledTimes(1);
    expect(commands[10].getContent.mock).not.toHaveBeenCalled();

    expect(ChildScript.commands[0].getContent.mock).toHaveBeenCalledTimes(1);
    expect(ChildScript.commands[0].getContent.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { desc: 'fabulous' },
    });
    expect(ChildScript.commands[1].condition.mock).toHaveBeenCalledTimes(1);
    expect(ChildScript.commands[1].condition.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { desc: 'fabulous' },
    });

    expect(ChildScript.initVars.mock).toHaveBeenCalledTimes(1);
    expect(MockScript.initVars.mock).not.toHaveBeenCalled();
  });

  test('start from child script', async () => {
    MockScript.commands[5].condition.mock.fakeReturnValue(false);
    await expect(
      execute(
        scope,
        channel,
        [
          {
            script: MockScript,
            vars: { foo: 'bar' },
            stopAt: 'CALL',
          },
          {
            script: ChildScript,
            vars: { foo: 'baz' },
            stopAt: 'CHILD_PROMPT',
          },
        ],
        false,
        { hello: 'subscript' }
      )
    ).resolves.toEqual({
      finished: true,
      returnedValue: { foo: 'baz', hello: 'subscript' },
      stack: null,
      contents: ['world'],
    });

    expect(MockScript.initVars.mock).not.toHaveBeenCalled();

    let { commands } = MockScript;
    expect(commands[0].condition.mock).not.toHaveBeenCalled();
    expect(commands[1].getContent.mock).not.toHaveBeenCalled();
    expect(commands[3].getContent.mock).not.toHaveBeenCalled();
    expect(commands[5].condition.mock).toHaveBeenCalledTimes(1);
    expect(commands[5].condition.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'baz', hello: 'subscript' },
    });
    expect(commands[6].setVars.mock).not.toHaveBeenCalled();
    expect(commands[8].withParams.mock).not.toHaveBeenCalled();
    expect(commands[8].setVars.mock).toHaveBeenCalledTimes(1);
    expect(commands[8].setVars.mock).toHaveBeenCalledWith(
      { platform: 'test', channel, vars: { foo: 'bar' } },
      { foo: 'baz', hello: 'subscript' }
    );
    expect(commands[10].getContent.mock).toHaveBeenCalledTimes(1);
    expect(commands[10].getContent.mock).toHaveBeenCalledWith({
      platform: 'test',
      channel,
      vars: { foo: 'baz', hello: 'subscript' },
    });

    ({ commands } = ChildScript);
    expect(commands[0].getContent.mock).not.toHaveBeenCalled();
    expect(commands[1].condition.mock).not.toHaveBeenCalled();
    expect(commands[2].setVars.mock).toHaveBeenCalledTimes(1);
    expect(commands[2].setVars.mock).toHaveBeenCalledWith(
      { platform: 'test', channel, vars: { foo: 'baz' } },
      { hello: 'subscript' }
    );

    expect(MockScript.initVars.mock).not.toHaveBeenCalled();
    expect(ChildScript.initVars.mock).not.toHaveBeenCalled();
  });
});

it('throw if stopped point key not found', async () => {
  const script = mockScript(
    [{}, {}],
    new Map([
      ['foo', 0],
      ['bar', 1],
    ]),
    'MyScript'
  );
  await expect(() =>
    execute(
      scope,
      channel,
      [{ script, vars: {}, stopAt: 'UNKNOWN' }],
      false,
      {}
    )
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `"key \\"UNKNOWN\\" not found in MyScript"`
  );
});

it('throw if stopped point is not <Prompt/>', async () => {
  const script = mockScript(
    [
      { type: 'content', getContent: () => 'R U Cathy?' },
      { type: 'prompt', key: 'prompt#0' },
    ],
    new Map([
      ['ask', 0],
      ['prompt#0', 1],
    ]),
    'MyScript'
  );
  await expect(() =>
    execute(scope, channel, [{ script, vars: {}, stopAt: 'ask' }], false, {
      event: { text: 'yes' },
    })
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `"stopped point \\"ask\\" is not a <Prompt/>, the key mapping of MyScript might have been changed"`
  );
});

it('throw if returned point is not <Call/>', async () => {
  const subScript = mockScript(
    [
      { type: 'content', getContent: () => 'how R U?' },
      { type: 'prompt', key: 'prompt#0' },
    ],
    new Map([
      ['ask', 0],
      ['prompt#0', 1],
    ]),
    'ChildScript'
  );
  const script = mockScript(
    [
      { type: 'content', getContent: () => 'hi' },
      { type: 'call', script: subScript, key: 'call#0' },
    ],
    new Map([
      ['greet', 0],
      ['call#0', 1],
    ]),
    'MyScript'
  );
  await expect(() =>
    execute(
      scope,
      channel,
      [
        { script, vars: {}, stopAt: 'greet' },
        { script: subScript, vars: {}, stopAt: 'prompt#0' },
      ],
      false,
      { event: { text: 'fine' } }
    )
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `"returned point \\"greet\\" is not a <Call/>, the key mapping of MyScript might have been changed"`
  );
});

import MessengerBot from '../bot';

it('throw if accessToken not given', () => {
  const options = {
    appSecret: '_SECRET_',
    verifyToken: '_VERIFIY_TOKEN_',
  };

  expect(() => new MessengerBot(options)).toThrowErrorMatchingInlineSnapshot(
    `"should provide accessToken to send messenge"`
  );
});

it('throw if appSecret not given', () => {
  const options = {
    accessToken: '_ACCESS_TOKEN_',
    verifyToken: '_VERIFIY_TOKEN_',
  };

  expect(() => new MessengerBot(options)).toThrowErrorMatchingInlineSnapshot(
    `"should provide appSecret if shouldValidateEvent set to true"`
  );
});

it('is ok to have appSecret empty if shouldValidateRequest set to false', () => {
  const options = {
    accessToken: '_ACCESS_TOKEN_',
    verifyToken: '_VERIFIY_TOKEN_',
    shouldValidateRequest: false,
  };

  expect(() => new MessengerBot(options)).not.toThrow();
});

it('throw if verifyToken not given', () => {
  const options = {
    accessToken: '_ACCESS_TOKEN_',
    appSecret: '_SECRET_',
  };

  expect(() => new MessengerBot(options)).toThrowErrorMatchingInlineSnapshot(
    `"should provide verifyToken if shouldVerifyWebhook set to true"`
  );
});

it('is ok to have verifyToken empty if shouldVerifyWebhook set to false', () => {
  const options = {
    accessToken: '_ACCESS_TOKEN_',
    appSecret: '_SECRET_',
    shouldVerifyWebhook: false,
  };

  expect(() => new MessengerBot(options)).not.toThrow();
});

it('set default options', () => {
  const options = {
    accessToken: '_ACCESS_TOKEN_',
    appSecret: '_SECRET_',
    verifyToken: '_VERIFIY_TOKEN_',
  };

  expect(new MessengerBot(options).options).toEqual({
    appSecret: '_SECRET_',
    accessToken: '_ACCESS_TOKEN_',
    shouldValidateRequest: true,
    shouldVerifyWebhook: true,
    verifyToken: '_VERIFIY_TOKEN_',
    respondTimeout: 5000,
    consumeInterval: 100,
  });
});

it('cover default options', () => {
  const options = {
    appSecret: '_SECRET_',
    accessToken: '_ACCESS_TOKEN_',
    shouldValidateRequest: true,
    shouldVerifyWebhook: true,
    verifyToken: '_VERIFIY_TOKEN_',
    respondTimeout: 9999,
    consumeInterval: 10000,
  };

  expect(new MessengerBot(options).options).toEqual(options);
});
